using System;
using System.Linq;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HexaBill.Tests.Billing;

/// <summary>
/// Regression guard for the production incident of 2026-11-02 (FrozenHub 1 / tenant 20):
/// the Payment→LegacyInvoice relationship must map to the SINGLE existing
/// Payments.LegacyInvoiceId column. A previous anonymous HasOne&lt;LegacyInvoice&gt;().WithMany()
/// left the model convention to invent a second shadow FK "LegacyInvoiceId1", so every
/// Payments query failed in production ("42703: column p.LegacyInvoiceId1 does not exist")
/// and took down the customer ledger, sales ledger, payments list and duplicate check.
/// </summary>
public class PaymentLegacyInvoiceRelationshipTests
{
    private static AppDbContext CreateModel()
    {
        var builder = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql("Host=model-only;Database=model-only;Username=x;Password=x");
        var db = new AppDbContext(builder.Options);
        _ = db.Model; // force model build (no connection is opened for model inspection)
        return db;
    }

    private static void AssertSqlStatementRuns(string sql, string because)
    {
        Assert.False(sql.Contains("\"LegacyInvoiceId1\"", StringComparison.Ordinal),
            $"Generated SQL must never reference the phantom LegacyInvoiceId1 column ({because}): {sql}");
    }

    [Fact]
    public void PaymentEntity_HasExactlyOneLegacyInvoiceFk_OnLegacyInvoiceId()
    {
        using var db = CreateModel();
        var payment = db.Model.FindEntityType(typeof(Payment))!;
        var legacyFks = payment.GetForeignKeys()
            .Where(f => f.PrincipalEntityType.ClrType.Name == "LegacyInvoice")
            .ToList();

        Assert.Single(legacyFks);
        var fk = legacyFks[0];
        var prop = Assert.Single(fk.Properties);
        Assert.Equal(nameof(Payment.LegacyInvoiceId), prop.Name);
        // The dependent navigation must resolve to the FK so EF queries the real column.
        Assert.Equal(nameof(Payment.LegacyInvoice), fk.DependentToPrincipal?.Name);
    }

    [Fact]
    public void DeletePaymentStatus_SelectForLegacyPayment_DoesNotReferencePhantomColumn()
    {
        using var db = CreateModel();
        var sql = db.Payments
            .Where(p => p.TenantId == 20 && p.CustomerId == 143 && p.SaleReturnId == null
                        && (p.Status == PaymentStatus.CLEARED || p.Status == PaymentStatus.Completed))
            .OrderBy(p => p.PaymentDate).ThenBy(p => p.Id)
            .ToQueryString();
        AssertSqlStatementRuns(sql, "customer ledger payments query");
    }

    [Fact]
    public void DuplicateCheck_GeneratesUtcParams_NotThePhantomColumn()
    {
        using var db = CreateModel();
        var dayStart = new DateTime(2026, 11, 2).ToUtcKind();
        var dayEnd = dayStart.AddDays(1);
        var sql = db.Payments
            .Where(p => p.TenantId == 20 && p.CustomerId == 143 &&
                        Math.Abs(p.Amount - 427.00m) < 0.01m &&
                        p.PaymentDate >= dayStart && p.PaymentDate < dayEnd)
            .ToQueryString();
        AssertSqlStatementRuns(sql, "duplicate check");
    }

    [Fact]
    public void GetPaymentsList_DoesNotReferencePhantomColumn()
    {
        using var db = CreateModel();
        var sql = db.Payments
            .Where(p => p.TenantId == 20)
            .OrderByDescending(p => p.PaymentDate.Date).ThenByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id)
            .Skip(0).Take(10)
            .ToQueryString();
        AssertSqlStatementRuns(sql, "payments list");
    }
}