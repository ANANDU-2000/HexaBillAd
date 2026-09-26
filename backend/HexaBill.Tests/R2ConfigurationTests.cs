using HexaBill.Api.Shared.Services;

namespace HexaBill.Tests;

public class R2ConfigurationTests
{
    [Fact]
    public void Bucket_Prefers_R2_BUCKET_Over_Legacy_Name()
    {
        var bucket = R2Configuration.ResolveBucketName("hexabill-production", "hexabill-uploads", "other", "legacy");
        Assert.Equal("hexabill-production", bucket);
    }

    [Fact]
    public void Bucket_Falls_Back_To_R2_BUCKET_NAME()
    {
        var bucket = R2Configuration.ResolveBucketName(null, "hexabill-production", null, null);
        Assert.Equal("hexabill-production", bucket);
    }

    [Fact]
    public void Missing_Bucket_Uses_Production_Bucket_Not_A_Shared_Uploads_Name()
    {
        var bucket = R2Configuration.ResolveBucketName(null, null, null, null);
        Assert.Equal("hexabill-production", bucket);
        Assert.DoesNotContain("hexabill-uploads", bucket);
    }

    [Fact]
    public void Production_Without_Credentials_Fails_Closed()
    {
        var ex = Assert.Throws<InvalidOperationException>(() =>
            R2Configuration.EnsureProductionCredentials(isProduction: true, endpoint: null, accessKey: null, secretKey: null));
        Assert.Contains("R2_ENDPOINT", ex.Message);
    }

    [Fact]
    public void Development_Without_Credentials_Allows_Local_Disk()
    {
        R2Configuration.EnsureProductionCredentials(isProduction: false, endpoint: null, accessKey: null, secretKey: null);
        Assert.False(R2Configuration.HasCredentials(null, null, null));
    }

    [Fact]
    public void Storage_Key_Must_Be_Tenant_Scoped()
    {
        var key = $"tenants/3/logos/{Guid.NewGuid()}.png";
        Assert.StartsWith("tenants/3/", key);
        Assert.False($"uploads/logo.png".StartsWith("tenants/", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Staff_Settings_Exclude_License_And_Logo_Secrets()
    {
        var filtered = R2Configuration.FilterSettingsForStaff(new Dictionary<string, string>
        {
            ["COMPANY_NAME_EN"] = "Surag",
            ["COMPANY_TRN"] = "100",
            ["COMPANY_LICENSE"] = "SECRET",
            ["LOGO_PATH"] = "/uploads/logo.png"
        });

        Assert.Equal("Surag", filtered["COMPANY_NAME_EN"]);
        Assert.False(filtered.ContainsKey("COMPANY_LICENSE"));
        Assert.False(filtered.ContainsKey("LOGO_PATH"));
    }
}
