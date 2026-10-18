using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

/// <summary>
/// The browser releases a saved payment request when the server answers 400/422. That is only safe if such an answer proves nothing was
/// saved for that idempotency key: the server must look the key up BEFORE it checks open invoices. These cases pin that order.
/// </summary>
[Collection("HttpIntegration")]
public class PaymentRejectionHttpTests
{
    private const int Company = 9420;
    private const string Slug = "payreject";
    private const int Owner = 9420;
    private const int WithInvoice = 9420;
    private const int WithoutInvoice = 9421;
    private const int OpenSale = 9420;

    private static readonly object FixtureLock = new();
    private readonly HexaBillWebApplicationFactory _factory;

    public PaymentRejectionHttpTests(HexaBillWebApplicationFactory factory)
    {
        _factory = factory;
        lock (FixtureLock)
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.SetRequestTenantScope(null, true);
            if (db.Users.IgnoreQueryFilters().Any(u => u.Id == Owner)) return;
            var now = DateTime.UtcNow;
            db.Tenants.Add(new Tenant { Id = Company, Name = "Payment rejection company", Subdomain = Slug, Status = TenantStatus.Active, FeaturesJson = "[]" });
            db.SaveChanges();
            db.Users.Add(new User { Id = Owner, TenantId = Company, OwnerId = Company, Name = "Pay owner", Email = "pay-reject@http.test", PasswordHash = "x", Role = UserRole.Owner, SessionVersion = 1, IsActive = true, CreatedAt = now });
            db.Customers.AddRange(
                new Customer { Id = WithInvoice, TenantId = Company, OwnerId = Company, Name = "Pay with invoice", Balance = 100m, PendingBalance = 100m, CreatedAt = now, UpdatedAt = now },
                new Customer { Id = WithoutInvoice, TenantId = Company, OwnerId = Company, Name = "Pay without invoice", CreatedAt = now, UpdatedAt = now });
            db.SaveChanges();
            db.Sales.Add(new Sale
            {
                Id = OpenSale, TenantId = Company, OwnerId = Company, CreatedBy = Owner, CustomerId = WithInvoice, InvoiceNo = "PAYREJ-0001",
                InvoiceDate = now.AddDays(-5), DueDate = now.AddDays(25), GrandTotal = 100m, TotalAmount = 100m, Subtotal = 100m, PaidAmount = 0m,
                PaymentStatus = SalePaymentStatus.Pending, CreatedAt = now,
            });
            db.SaveChanges();
        }
    }

    private HttpClient Client()
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, BaseAddress = new Uri($"http://{Slug}.hexabill.company") });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", TestJwtFactory.CreateAuthenticatedApiToken(Owner, Company, Slug, role: "Owner"));
        return client;
    }

    private static Task<HttpResponseMessage> Post(HttpClient client, object body, string key)
    {
        var message = new HttpRequestMessage(HttpMethod.Post, "/api/payments") { Content = JsonContent.Create(body) };
        message.Headers.TryAddWithoutValidation("Idempotency-Key", key);
        return client.SendAsync(message);
    }

    private int PaymentsOf(int customerId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.SetRequestTenantScope(null, true);
        return db.Payments.IgnoreQueryFilters().Count(p => p.CustomerId == customerId && p.TenantId == Company);
    }

    [Fact]
    public async Task ACustomerWithNoOpenInvoice_IsRefusedWith400_AndNothingIsSaved_EvenWhenTheKeyIsRetried()
    {
        using var client = Client();
        var body = new { customerId = WithoutInvoice, amount = 50m, mode = "CASH" };
        var key = Guid.NewGuid().ToString();
        var first = await Post(client, body, key);
        Assert.Equal(HttpStatusCode.BadRequest, first.StatusCode);
        var again = await Post(client, body, key);
        Assert.Equal(HttpStatusCode.BadRequest, again.StatusCode);
        Assert.Equal(0, PaymentsOf(WithoutInvoice));
    }

    [Fact]
    public async Task ASavedKey_ReplaysItsPayment_EvenAfterTheInvoiceIsFullyPaid_WhileANewKeyIsRefused()
    {
        using var client = Client();
        var body = new { saleId = OpenSale, customerId = WithInvoice, amount = 100m, mode = "CASH" };
        var key = Guid.NewGuid().ToString();
        var saved = await Post(client, body, key);
        Assert.True(saved.IsSuccessStatusCode, $"first save returned {(int)saved.StatusCode}");
        var paymentId = (await saved.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data").GetProperty("payment").GetProperty("id").GetInt32();

        // The reply was "lost": the browser sends the same request again. The invoice is now fully paid, yet the server answers with the saved payment.
        var replay = await Post(client, body, key);
        Assert.True(replay.IsSuccessStatusCode, $"replay returned {(int)replay.StatusCode}");
        Assert.Equal(paymentId, (await replay.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data").GetProperty("payment").GetProperty("id").GetInt32());

        // A different key is a new payment and is refused (nothing left to pay): the 400 therefore proves nothing was saved for THAT key.
        var other = await Post(client, body, Guid.NewGuid().ToString());
        Assert.Equal(HttpStatusCode.BadRequest, other.StatusCode);
        Assert.Equal(1, PaymentsOf(WithInvoice));
    }
}
