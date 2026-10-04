namespace HexaBill.Tests;

[CollectionDefinition("HttpIntegration", DisableParallelization = true)]
public sealed class HttpIntegrationCollection
    : ICollectionFixture<HexaBillWebApplicationFactory>,
      ICollectionFixture<HexaBillEnforcedHostWebApplicationFactory>;
