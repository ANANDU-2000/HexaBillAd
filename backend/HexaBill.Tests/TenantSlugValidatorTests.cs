using HexaBill.Api.Shared.Hosting;

namespace HexaBill.Tests;

public class TenantSlugValidatorTests
{
    [Theory]
    [InlineData("client1")]
    [InlineData("abc-company")]
    [InlineData("a1b")]
    public void AcceptsValidLowercaseSlugs(string slug)
    {
        Assert.True(TenantSlugValidator.IsValid(slug));
    }

    [Theory]
    [InlineData("ab")]
    [InlineData("Client1")]
    [InlineData("client--one")]
    [InlineData("-client")]
    [InlineData("client-")]
    [InlineData("admin")]
    [InlineData("client_1")]
    [InlineData("cℓient")]
    public void RejectsUnsafeOrReservedSlugs(string slug)
    {
        Assert.False(TenantSlugValidator.IsValid(slug));
    }

    [Fact]
    public void NormalizeLowercasesAndTrimsBeforeValidation()
    {
        Assert.Equal("client1", TenantSlugValidator.Normalize("  CLIENT1 "));
    }

    [Theory]
    [InlineData("ABC Traders", "abc-traders")]
    [InlineData("Acme / Retail", "acme-retail")]
    public void SuggestCreatesSafeSlugs(string companyName, string expected)
    {
        Assert.Equal(expected, TenantSlugValidator.Suggest(companyName));
    }

    [Fact]
    public void SuggestUsesSafeFallbackForReservedOrEmptyValues()
    {
        Assert.Equal("tenant", TenantSlugValidator.Suggest("admin"));
        Assert.Equal("tenant", TenantSlugValidator.Suggest(""));
    }
}
