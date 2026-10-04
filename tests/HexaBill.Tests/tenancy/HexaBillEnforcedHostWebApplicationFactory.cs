using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;

namespace HexaBill.Tests;

/// <summary>HTTP integration with production-like host enforcement (TEN01).</summary>
public sealed class HexaBillEnforcedHostWebApplicationFactory : HexaBillWebApplicationFactory
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Hosting:EnforcementMode"] = "Enforce",
            });
        });
    }
}
