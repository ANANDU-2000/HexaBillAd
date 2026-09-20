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
}
