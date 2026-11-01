using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Models.Legacy;
using HexaBill.Api.Modules.Customers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HexaBill.Tests.Billing
{
    public class CustomerServiceLegacyContinuityTests
    {
        private static async Task<AppDbContext> CreateInMemoryDbAsync()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite("Data Source=:memory:")
                .Options;

            var db = new AppDbContext(options);
            await db.Database.OpenConnectionAsync();
            await db.Database.EnsureCreatedAsync();
            return db;
        }

        [Fact]
        public async Task GetOutstandingInvoicesAsync_IncludesLegacyPendingInvoices_ForTenant20_AndIsolatesTenant23()
        {
            await using var db = await CreateInMemoryDbAsync();

            // Seed customer for Tenant 20
            var customer = new Customer
            {
                Id = 136,
                TenantId = 20,
                OwnerId = 20,
                Name = "CHAWARMA AALMASHI SNACK",
                Phone = "0501234567",
                Balance = 8954m,
                CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            };
            db.Customers.Add(customer);

            // Seed LegacyInvoices for Tenant 20 (including 2 pending and 1 paid)
            db.LegacyInvoices.Add(new LegacyInvoice
            {
                Id = 501,
                TenantId = 20,
                SourceInvoiceId = 4403,
                SourceSystem = "Starplus",
                LegacyInvoiceNumber = "4403",
                LegacyIssuer = "Starplus Foodstuff Trading",
                InvoiceDate = new DateTime(2026, 4, 21, 0, 0, 0, DateTimeKind.Utc),
                DestinationCustomerId = 136,
                GrandTotal = 945m,
                TotalAmount = 945m,
                PaidAmount = 0m,
                OutstandingCalculated = 945m,
                Status = "Pending",
                IsDeleted = false
            });

            db.LegacyInvoices.Add(new LegacyInvoice
            {
                Id = 502,
                TenantId = 20,
                SourceInvoiceId = 4383,
                SourceSystem = "Starplus",
                LegacyInvoiceNumber = "4383",
                LegacyIssuer = "Starplus Foodstuff Trading",
                InvoiceDate = new DateTime(2026, 4, 20, 0, 0, 0, DateTimeKind.Utc),
                DestinationCustomerId = 136,
                GrandTotal = 945m,
                TotalAmount = 945m,
                PaidAmount = 0m,
                OutstandingCalculated = 945m,
                Status = "Pending",
                IsDeleted = false
            });

            db.LegacyInvoices.Add(new LegacyInvoice
            {
                Id = 503,
                TenantId = 20,
                SourceInvoiceId = 4000,
                SourceSystem = "Starplus",
                LegacyInvoiceNumber = "4000",
                LegacyIssuer = "Starplus Foodstuff Trading",
                InvoiceDate = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc),
                DestinationCustomerId = 136,
                GrandTotal = 500m,
                TotalAmount = 500m,
                PaidAmount = 500m,
                OutstandingCalculated = 0m,
                Status = "Paid",
                IsDeleted = false
            });

            await db.SaveChangesAsync();
            db.SetRequestTenantScope(20, false);

            var service = new CustomerService(db);

            // 1. Query Tenant 20 for Customer 136
            var resultTenant20 = await service.GetOutstandingInvoicesAsync(136, 20);
            Assert.Equal(2, resultTenant20.Count);
            Assert.Contains(resultTenant20, x => x.InvoiceNo == "4403" && x.BalanceAmount == 945m && x.IsLegacy);
            Assert.Contains(resultTenant20, x => x.InvoiceNo == "4383" && x.BalanceAmount == 945m && x.IsLegacy);
            Assert.DoesNotContain(resultTenant20, x => x.InvoiceNo == "4000"); // Paid invoice should not be returned

            // 2. Strict Tenant Isolation: Query Tenant 23 for Customer 136 returns 0
            var resultTenant23 = await service.GetOutstandingInvoicesAsync(136, 23);
            Assert.Empty(resultTenant23);
        }

        [Fact]
        public async Task GetCustomerLedgerAsync_HistoricalRange_ProducesExactCutoverBalance_WithoutDoubleCounting()
        {
            await using var db = await CreateInMemoryDbAsync();

            // Seed customer with cutover opening balance
            var customer = new Customer
            {
                Id = 136,
                TenantId = 20,
                OwnerId = 20,
                Name = "CHAWARMA AALMASHI SNACK",
                Balance = 8954m,
                CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            };
            db.Customers.Add(customer);

            db.LegacyOpeningReceivables.Add(new LegacyOpeningReceivable
            {
                Id = 1,
                TenantId = 20,
                SourceCustomerId = 24,
                DestinationCustomerId = 136,
                OpeningBalance = 8954m,
                ReconciledInvoicesCount = 112,
                CutoffDate = new DateTime(2026, 10, 31, 23, 59, 59, DateTimeKind.Utc),
                ApprovedAt = DateTime.UtcNow
            });

            // Seed historical invoice 1: 10,000 AED
            db.LegacyInvoices.Add(new LegacyInvoice
            {
                Id = 1,
                TenantId = 20,
                SourceInvoiceId = 101,
                LegacyInvoiceNumber = "4001",
                LegacyIssuer = "Starplus Foodstuff Trading",
                InvoiceDate = new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc),
                DestinationCustomerId = 136,
                GrandTotal = 10000m,
                TotalAmount = 10000m,
                PaidAmount = 1046m,
                OutstandingCalculated = 8954m,
                Status = "Partial",
                IsDeleted = false
            });

            // Seed historical payment 1: 1,046 AED
            db.LegacyPayments.Add(new LegacyPayment
            {
                Id = 1,
                TenantId = 20,
                SourcePaymentId = 201,
                LegacyInvoiceId = 1,
                Reference = "4001",
                SourceCustomerId = 24,
                DestinationCustomerId = 136,
                Amount = 1046m,
                Mode = "Cash",
                Status = "Cleared",
                PaymentDate = new DateTime(2026, 3, 5, 0, 0, 0, DateTimeKind.Utc)
            });

            await db.SaveChangesAsync();
            db.SetRequestTenantScope(20, false);

            var service = new CustomerService(db);

            // Query ledger from 2026-01-01 to 2026-11-01
            var from = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var to = new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc);
            var ledger = await service.GetCustomerLedgerAsync(136, 20, fromDate: from, toDate: to);

            // Assertions:
            // 1. Should have 2 transactions: Invoice 4001 (10,000 debit) and Payment 201 (1,046 credit)
            Assert.Equal(2, ledger.Count);

            var invEntry = ledger[0];
            Assert.Equal("Invoice", invEntry.Type);
            Assert.Equal("4001", invEntry.Reference);
            Assert.Equal(10000m, invEntry.Debit);
            Assert.Equal(10000m, invEntry.Balance);
            Assert.True(invEntry.IsLegacy);

            var payEntry = ledger[1];
            Assert.Equal("Payment", payEntry.Type);
            Assert.Equal(1046m, payEntry.Credit);
            Assert.Equal(8954m, payEntry.Balance);
            Assert.True(payEntry.IsLegacy);

            // Final balance is EXACTLY 8,954.00 AED — NOT 17,908.00 AED (Zero double-counting!)
            Assert.Equal(8954m, ledger[^1].Balance);
        }
    }
}
