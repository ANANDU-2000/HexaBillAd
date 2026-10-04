using Xunit;

namespace HexaBill.Tests;

internal static class PostgresIntegrationSkip
{
    public const string Reason =
        "Set HEXABILL_TEST_POSTGRES to a dedicated test database connection string.";

    public static HexaBillPostgreSqlWebApplicationFactory RequireFactory(
        HexaBillPostgreSqlWebApplicationFactory? factory)
    {
        Skip.If(factory is null, Reason);
        return factory!;
    }
}

[CollectionDefinition("HttpPostgresIntegration")]
public sealed class HttpPostgresIntegrationCollection : ICollectionFixture<HttpPostgresIntegrationFixture>;

public sealed class HttpPostgresIntegrationFixture : IAsyncLifetime
{
    public HexaBillPostgreSqlWebApplicationFactory? Factory { get; private set; }

    public Task InitializeAsync()
    {
        var connectionString = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        if (!string.IsNullOrWhiteSpace(connectionString))
            Factory = new HexaBillPostgreSqlWebApplicationFactory(connectionString);
        return Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        if (Factory != null)
            await Factory.DisposeAsync();
    }
}
