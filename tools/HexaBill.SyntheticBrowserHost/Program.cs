using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Text.Json;
using HexaBill.Api.Modules.SuperAdmin;

// Test-only HTTP bridge to the actual API TestServer. No product readiness bypass.
var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES")
    ?? throw new InvalidOperationException("Set a dedicated local HEXABILL_TEST_POSTGRES.");
var cs = new NpgsqlConnectionStringBuilder(connection);
var receiptFixtureMode = args.Contains("--receipt-snapshot-fixtures", StringComparer.Ordinal);
if (receiptFixtureMode && cs.Database?.StartsWith("hexabill_codex_browser_receipts_", StringComparison.Ordinal) != true)
    throw new InvalidOperationException("Refused: receipt snapshot mode requires a dedicated receipt-test database.");
if (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") != "Development"
    || cs.Host is not ("127.0.0.1" or "localhost" or "::1")
    || cs.Database?.StartsWith("hexabill_codex_browser_", StringComparison.Ordinal) != true)
    throw new InvalidOperationException("Refused: Development, loopback, and a dedicated browser database are required.");
var apiRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../backend/HexaBill.Api"));
if (!File.Exists(Path.Combine(apiRoot, "HexaBill.Api.csproj")))
    throw new InvalidOperationException("Run from this repository's built tool; API project is missing.");

await using (var guard = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection).Options))
{
    guard.SetRequestTenantScope(null, true);
    var tenants = await guard.Tenants.Select(t => new { t.Subdomain, t.FeaturesJson }).ToListAsync();
    var expected = new[] { "gulfharvest-test", "frozenhub1-test", "frozenhub2-test", "zayogya-test" };
    var snapshotFlags = JsonSerializer.Serialize(new[] { TenantFeatureFlags.ReceiptSnapshots });
    if (tenants.Count != expected.Length || tenants.Any(t => !expected.Contains(t.Subdomain)
        || t.FeaturesJson != (receiptFixtureMode && t.Subdomain == "gulfharvest-test" ? snapshotFlags : "[]")))
        throw new InvalidOperationException("Refused: seed the four isolated tenants with the exact expected synthetic flags first.");
}

Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", connection);
Environment.SetEnvironmentVariable("DATABASE_URL", string.Empty);
Environment.SetEnvironmentVariable("ConnectionStrings__PostgreSQL", string.Empty);
var signingKey = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(64));
Environment.SetEnvironmentVariable("JWT_SECRET_KEY", signingKey);
Environment.SetEnvironmentVariable("JwtSettings__SecretKey", signingKey);
Environment.SetEnvironmentVariable("HEXABILL_HTTP_INTEGRATION_TEST", "1");
Environment.SetEnvironmentVariable("DATA_PATH", Path.Combine(Path.GetTempPath(), $"hexabill-browser-storage-{Guid.NewGuid():N}"));
foreach (var key in new[] { "R2_ENDPOINT", "R2_ACCESS_KEY", "R2_SECRET_KEY" }) Environment.SetEnvironmentVariable(key, string.Empty);
using var factory = new BrowserApiFactory(apiRoot, connection);
using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
factory.Services.GetRequiredService<DatabaseInitializationStatus>().CompleteInitialization(hasPendingMigrations: false);

var bridgeBuilder = WebApplication.CreateSlimBuilder(args);
bridgeBuilder.Logging.ClearProviders();
bridgeBuilder.WebHost.UseUrls("http://127.0.0.1:5078");
var bridge = bridgeBuilder.Build();
bridge.MapGet("/__synthetic-host", () => new { syntheticOnly = true, migrationProof = false,
    flags = receiptFixtureMode ? "receipt_snapshots (gulfharvest-test only, synthetic opt-in)" : "OFF" });
bridge.MapFallback("/{**path}", async context =>
{
    using var request = new HttpRequestMessage(new HttpMethod(context.Request.Method), context.Request.Path + context.Request.QueryString);
    request.Content = new StreamContent(context.Request.Body);
    foreach (var header in context.Request.Headers)
    {
        if (header.Key.Equals("Host", StringComparison.OrdinalIgnoreCase)) { request.Headers.Host = header.Value.ToString(); continue; }
        if (header.Key.Equals("Content-Length", StringComparison.OrdinalIgnoreCase)) continue;
        if (!request.Headers.TryAddWithoutValidation(header.Key, header.Value.ToArray()))
            request.Content.Headers.TryAddWithoutValidation(header.Key, header.Value.ToArray());
    }
    using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, context.RequestAborted);
    context.Response.StatusCode = (int)response.StatusCode;
    foreach (var header in response.Headers.Concat(response.Content.Headers))
        if (!header.Key.Equals("Transfer-Encoding", StringComparison.OrdinalIgnoreCase))
            context.Response.Headers[header.Key] = header.Value.ToArray();
    await response.Content.CopyToAsync(context.Response.Body, context.RequestAborted);
});
Console.WriteLine("Synthetic browser API bridge: loopback 5078; migrationProof=false; production readiness is not certified.");
await bridge.RunAsync();

sealed class BrowserApiFactory(string apiRoot, string connection) : WebApplicationFactory<AppDbContext>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseContentRoot(apiRoot).UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = connection,
            ["Hosting:EnforcementMode"] = "Enforce",
            ["Logging:LogLevel:Default"] = "Warning"
        }));
        builder.ConfigureTestServices(services =>
        {
            foreach (var descriptor in services.Where(d => d.ServiceType == typeof(IHostedService)).ToList()) services.Remove(descriptor);
        });
    }
}
