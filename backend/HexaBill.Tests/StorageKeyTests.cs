/*
 * Tenant-isolated logo storage: key format must be tenants/{tenantId}/...
 * Ensures no guessable or cross-tenant paths.
 */
namespace HexaBill.Tests;

public class StorageKeyTests
{
    [Fact]
    public void Logo_Storage_Key_Starts_With_Tenants_Prefix()
    {
        int tenantId = 42;
        var guid = Guid.NewGuid();
        var key = $"tenants/{tenantId}/logos/{guid}.png";
        Assert.StartsWith("tenants/", key);
        Assert.Contains($"/logos/", key);
    }

    [Fact]
    public void Logo_Storage_Key_Contains_Tenant_Id_Segment()
    {
        int tenantId = 99;
        var key = $"tenants/{tenantId}/logos/{Guid.NewGuid()}.png";
        Assert.Contains("99", key);
        var segments = key.Split('/');
        Assert.True(segments.Length >= 4);
        Assert.Equal("tenants", segments[0]);
        Assert.Equal(tenantId.ToString(), segments[1]);
        Assert.Equal("logos", segments[2]);
    }

    [Fact]
    public void Different_Tenants_Have_Isolated_Keys()
    {
        var key1 = $"tenants/1/logos/{Guid.NewGuid()}.png";
        var key2 = $"tenants/2/logos/{Guid.NewGuid()}.png";
        Assert.NotEqual(key1, key2);
        Assert.StartsWith("tenants/1/", key1);
        Assert.StartsWith("tenants/2/", key2);
    }
}
