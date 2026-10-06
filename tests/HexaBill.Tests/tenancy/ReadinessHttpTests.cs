using System.Net;
using System.Net.Http.Json;
using HexaBill.Api.Core.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public sealed class ReadinessHttpTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public ReadinessHttpTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task Ready_RejectsPendingInitializationAndPendingMigrations()
    {
        using var client = _factory.CreateClient();
        var status = _factory.Services.GetRequiredService<DatabaseInitializationStatus>();
        status.SetStateForTests(DatabaseInitializationState.Pending);
        try
        {
            var initializingResponse = await client.GetAsync("/health/ready");
            var initializingBody = await initializingResponse.Content.ReadFromJsonAsync<ReadinessResponse>();
            Assert.Equal(HttpStatusCode.ServiceUnavailable, initializingResponse.StatusCode);
            Assert.Equal("InitializationPending", initializingBody?.Schema);

            var businessResponse = await client.GetAsync("/api/customers");
            Assert.Equal(HttpStatusCode.ServiceUnavailable, businessResponse.StatusCode);
            Assert.Contains("InitializationPending", await businessResponse.Content.ReadAsStringAsync());
            var livenessResponse = await client.GetAsync("/health");
            Assert.Equal(HttpStatusCode.ServiceUnavailable, livenessResponse.StatusCode);

            status.CompleteInitialization(hasPendingMigrations: false);
            var schemaResponse = await client.GetAsync("/health/ready");
            var schemaBody = await schemaResponse.Content.ReadFromJsonAsync<ReadinessResponse>();
            Assert.Equal(HttpStatusCode.ServiceUnavailable, schemaResponse.StatusCode);
            Assert.Equal("Connected", schemaBody?.Database);
            Assert.Equal("MigrationsPending", schemaBody?.Schema);
            Assert.True(schemaBody?.PendingMigrationCount > 0);

            status.MarkFailed();
            status.CompleteInitialization(hasPendingMigrations: false);
            var failedInitializationResponse = await client.GetAsync("/health/ready");
            var failedInitializationBody = await failedInitializationResponse.Content.ReadFromJsonAsync<ReadinessResponse>();
            Assert.Equal(HttpStatusCode.ServiceUnavailable, failedInitializationResponse.StatusCode);
            Assert.Equal("InitializationFailed", failedInitializationBody?.Schema);

            var failedBusinessResponse = await client.GetAsync("/api/customers");
            Assert.Equal(HttpStatusCode.ServiceUnavailable, failedBusinessResponse.StatusCode);
            Assert.Contains("InitializationFailed", await failedBusinessResponse.Content.ReadAsStringAsync());
            var failedLivenessResponse = await client.GetAsync("/health");
            Assert.Equal(HttpStatusCode.ServiceUnavailable, failedLivenessResponse.StatusCode);
        }
        finally
        {
            status.SetStateForTests(DatabaseInitializationState.Ready);
        }
    }

    private sealed class ReadinessResponse
    {
        public string? Database { get; set; }
        public string? Schema { get; set; }
        public int? PendingMigrationCount { get; set; }
    }
}
