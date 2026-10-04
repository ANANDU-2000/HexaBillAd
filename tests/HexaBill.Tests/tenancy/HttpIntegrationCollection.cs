namespace HexaBill.Tests;

[CollectionDefinition("HttpIntegration")]
public sealed class HttpIntegrationCollection
    : ICollectionFixture<HexaBillWebApplicationFactory>,
      ICollectionFixture<HexaBillEnforcedHostWebApplicationFactory>;
