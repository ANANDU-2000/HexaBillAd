using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

/// <summary>The shop pin is optional, must be a real map point, and is stamped with who set it and when.</summary>
[Collection("HttpIntegration")]
public class CustomerLocationHttpTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public CustomerLocationHttpTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    private static string Phone() => $"052{Random.Shared.Next(1000000, 9999999)}";
    private static string Name() => $"Shoploc {Guid.NewGuid():N}";

    [Fact]
    public async Task Customer_WithoutALocation_IsCreated_AndHasNoPin()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.PostAsJsonAsync("/api/customers", new { name = Name(), phone = Phone() });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
        Assert.Equal(JsonValueKind.Null, data.GetProperty("mainLatitude").ValueKind);
    }

    [Theory]
    [InlineData(95.0, 55.0)]
    [InlineData(-91.0, 55.0)]
    [InlineData(25.0, 181.0)]
    [InlineData(0.0, 0.0)]
    public async Task ImpossibleMapPoints_AreRefused_AndNothingIsCreated(double lat, double lng)
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var name = Name();
        var response = await client.PostAsJsonAsync("/api/customers", new { name, phone = Phone(), mainLatitude = lat, mainLongitude = lng });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.Customers.IgnoreQueryFilters().AnyAsync(c => c.Name == name));
    }

    [Fact]
    public async Task OnlyOneCoordinate_IsRefused()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.PostAsJsonAsync("/api/customers", new { name = Name(), phone = Phone(), mainLatitude = 25.2 });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task ValidPin_IsSaved_WithWhoAndWhen_AndCanBeReplacedAndCleared()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var created = await client.PostAsJsonAsync("/api/customers", new { name = Name(), phone = Phone(), mainLatitude = 25.2048, mainLongitude = 55.2708 });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var data = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
        var id = data.GetProperty("id").GetInt32();
        Assert.Equal(25.2048m, data.GetProperty("mainLatitude").GetDecimal());
        Assert.Equal(JsonValueKind.String, data.GetProperty("locationUpdatedAt").ValueKind);
        Assert.Equal(1, data.GetProperty("locationUpdatedBy").GetInt32());

        var moved = await client.PutAsJsonAsync($"/api/customers/{id}", new { name = data.GetProperty("name").GetString(), mainLatitude = 24.4539, mainLongitude = 54.3773 });
        Assert.Equal(HttpStatusCode.OK, moved.StatusCode);
        Assert.Equal(24.4539m, (await moved.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data").GetProperty("mainLatitude").GetDecimal());

        var cleared = await client.PutAsJsonAsync($"/api/customers/{id}", new { name = data.GetProperty("name").GetString(), clearMainLocation = true });
        Assert.Equal(HttpStatusCode.OK, cleared.StatusCode);
        Assert.Equal(JsonValueKind.Null, (await cleared.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data").GetProperty("mainLatitude").ValueKind);
    }

    [Fact]
    public async Task EditingOtherFields_WithoutALocation_KeepsTheSavedPin()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var created = await client.PostAsJsonAsync("/api/customers", new { name = Name(), phone = Phone(), mainLatitude = 25.2048, mainLongitude = 55.2708 });
        var data = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
        var id = data.GetProperty("id").GetInt32();
        var edited = await client.PutAsJsonAsync($"/api/customers/{id}", new { name = data.GetProperty("name").GetString(), address = "Changed address" });
        Assert.Equal(HttpStatusCode.OK, edited.StatusCode);
        Assert.Equal(25.2048m, (await edited.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data").GetProperty("mainLatitude").GetDecimal());
    }
}
