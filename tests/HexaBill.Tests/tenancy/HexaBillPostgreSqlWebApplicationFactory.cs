using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace HexaBill.Tests;

/// <summary>
/// HTTP integration host against PostgreSQL. Requires HEXABILL_TEST_POSTGRES (dedicated test DB).
/// </summary>
public sealed class HexaBillPostgreSqlWebApplicationFactory : WebApplicationFactory<Program>, IAsyncDisposable
{
    private readonly string _connectionString;
    private readonly string _storageDataPath;
    private bool _seeded;

    public int TenantAId { get; }
    public int TenantBId { get; }
    public string SlugA { get; }
    public string SlugB { get; }
    public int CustomerAId { get; private set; }
    public int CustomerBId { get; private set; }
    public int PaymentAId { get; private set; }
    public int PaymentBId { get; private set; }
    public int PaymentAdjustmentAId { get; private set; }
    public int SaleAId { get; private set; }
    public int SaleBId { get; private set; }
    public int SaleUnpaidAId { get; private set; }
    public int SaleFin01AId { get; private set; }
    public int SaleFin02LeaveAId { get; private set; }
    public int QuotationAId { get; private set; }
    public int QuotationBId { get; private set; }
    public int RecurringInvoiceAId { get; private set; }
    public int RecurringInvoiceBId { get; private set; }
    public int AgreementAId { get; private set; }
    public int AgreementBId { get; private set; }
    public int SalaryCertificateAId { get; private set; }
    public int SalaryCertificateBId { get; private set; }
    public int ExpenseCategoryAId { get; private set; }
    public int ExpenseCategoryBId { get; private set; }
    public int ExpenseAId { get; private set; }
    public int ExpenseBId { get; private set; }
    public int PurchaseAId { get; private set; }
    public int PurchaseBId { get; private set; }
    public int ProductAId { get; private set; }

    public HexaBillPostgreSqlWebApplicationFactory(string connectionString)
    {
        _connectionString = connectionString;
        TenantAId = 960_000 + Random.Shared.Next(1, 30_000);
        TenantBId = TenantAId + 1;
        SlugA = $"pgh-{TenantAId}";
        SlugB = $"pgh-{TenantBId}";
        _storageDataPath = Path.Combine(Path.GetTempPath(), $"hexa-pg-storage-{Guid.NewGuid():N}");
        Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", connectionString);
        Environment.SetEnvironmentVariable("DATABASE_URL", string.Empty);
        Environment.SetEnvironmentVariable("ConnectionStrings__PostgreSQL", string.Empty);
        Environment.SetEnvironmentVariable("HEXABILL_HTTP_INTEGRATION_TEST", "1");
        Environment.SetEnvironmentVariable("DATA_PATH", _storageDataPath);
        Environment.SetEnvironmentVariable("R2_ENDPOINT", string.Empty);
        Environment.SetEnvironmentVariable("R2_ACCESS_KEY", string.Empty);
        Environment.SetEnvironmentVariable("R2_SECRET_KEY", string.Empty);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = _connectionString,
                ["Hosting:EnforcementMode"] = "LogOnly",
                ["Hosting:BaseDomain"] = "hexabill.company",
                ["Hosting:PlatformHost"] = "admin.hexabill.company",
                ["Hosting:ApiHost"] = "api.hexabill.company",
            });
        });

        builder.ConfigureTestServices(services =>
        {
            foreach (var descriptor in services.Where(d => d.ServiceType == typeof(IHostedService)).ToList())
                services.Remove(descriptor);

            var pdfDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IPdfService));
            if (pdfDescriptor != null)
                services.Remove(pdfDescriptor);
            services.AddScoped<HttpTestPdfService>();
            services.AddScoped<IPdfService>(sp => sp.GetRequiredService<HttpTestPdfService>());
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);
        if (!_seeded)
        {
            SeedDatabase(host.Services);
            _seeded = true;
        }

        return host;
    }

    private void SeedDatabase(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.SetRequestTenantScope(null, true);
        _ = db.Database.EnsureCreated();

        var now = DateTime.UtcNow;
        db.Tenants.AddRange(
            new Tenant { Id = TenantAId, Name = "PG HTTP A", Subdomain = SlugA, Status = TenantStatus.Active, FeaturesJson = """["daily_close","receipt_snapshots","sale_cost_snapshots","settlement_adjustments"]""" },
            new Tenant { Id = TenantBId, Name = "PG HTTP B", Subdomain = SlugB, Status = TenantStatus.Active, FeaturesJson = """["daily_close"]""" });
        db.Settings.AddRange(
            new Setting
            {
                TenantId = TenantAId, OwnerId = TenantAId, Key = "COMPANY_NAME_EN", Value = "PG HTTP Company A",
                CreatedAt = now, UpdatedAt = now
            },
            new Setting
            {
                TenantId = TenantAId, OwnerId = TenantAId, Key = "COMPANY_TRN", Value = $"TRN-PG-{TenantAId}",
                CreatedAt = now, UpdatedAt = now
            },
            new Setting
            {
                TenantId = TenantBId, OwnerId = TenantBId, Key = "COMPANY_NAME_EN", Value = "PG HTTP Company B",
                CreatedAt = now, UpdatedAt = now
            },
            new Setting
            {
                TenantId = TenantBId, OwnerId = TenantBId, Key = "COMPANY_TRN", Value = $"TRN-PG-{TenantBId}",
                CreatedAt = now, UpdatedAt = now
            });

        db.Users.AddRange(
            new User
            {
                Id = TenantAId, TenantId = TenantAId, OwnerId = TenantAId, Name = "Owner A", Email = $"{SlugA}@http.test",
                PasswordHash = "x", Role = UserRole.Owner, SessionVersion = 1, IsActive = true, CreatedAt = now
            },
            new User
            {
                Id = TenantBId, TenantId = TenantBId, OwnerId = TenantBId, Name = "Owner B", Email = $"{SlugB}@http.test",
                PasswordHash = "x", Role = UserRole.Owner, SessionVersion = 1, IsActive = true, CreatedAt = now
            });

        var customerA = new Customer { TenantId = TenantAId, OwnerId = TenantAId, Name = "Cust A", CreatedAt = now, UpdatedAt = now };
        var customerB = new Customer { TenantId = TenantBId, OwnerId = TenantBId, Name = "Cust B", CreatedAt = now, UpdatedAt = now };
        db.Customers.AddRange(customerA, customerB);
        db.SaveChanges();
        CustomerAId = customerA.Id;
        CustomerBId = customerB.Id;

        var categoryA = new ExpenseCategory { TenantId = TenantAId, Name = "PG Exp Cat A", CreatedAt = now };
        var categoryB = new ExpenseCategory { TenantId = TenantBId, Name = "PG Exp Cat B", CreatedAt = now };
        db.ExpenseCategories.AddRange(categoryA, categoryB);
        db.SaveChanges();
        ExpenseCategoryAId = categoryA.Id;
        ExpenseCategoryBId = categoryB.Id;

        var expenseA = new Expense
        {
            TenantId = TenantAId, OwnerId = TenantAId, CategoryId = ExpenseCategoryAId, Amount = 10m, Date = now,
            Status = ExpenseStatus.Approved, CreatedBy = TenantAId, CreatedAt = now, PaidFrom = ExpensePaidFrom.Cash
        };
        var expenseB = new Expense
        {
            TenantId = TenantBId, OwnerId = TenantBId, CategoryId = ExpenseCategoryBId, Amount = 20m, Date = now,
            Status = ExpenseStatus.Approved, CreatedBy = TenantBId, CreatedAt = now, PaidFrom = ExpensePaidFrom.Cash
        };
        db.Expenses.AddRange(expenseA, expenseB);
        db.SaveChanges();
        ExpenseAId = expenseA.Id;
        ExpenseBId = expenseB.Id;

        var paymentA = new Payment
        {
            TenantId = TenantAId, OwnerId = TenantAId, CustomerId = CustomerAId, Amount = 50, Mode = PaymentMode.CASH,
            Status = PaymentStatus.CLEARED, CreatedBy = TenantAId, PaymentDate = now, CreatedAt = now
        };
        var paymentB = new Payment
        {
            TenantId = TenantBId, OwnerId = TenantBId, CustomerId = CustomerBId, Amount = 75, Mode = PaymentMode.CASH,
            Status = PaymentStatus.CLEARED, CreatedBy = TenantBId, PaymentDate = now, CreatedAt = now
        };
        db.Payments.AddRange(paymentA, paymentB);
        db.SaveChanges();
        PaymentAId = paymentA.Id;
        PaymentBId = paymentB.Id;

        var saleA = new Sale
        {
            TenantId = TenantAId, OwnerId = TenantAId, CustomerId = CustomerAId, InvoiceNo = $"PG-{TenantAId}-A",
            Subtotal = 100, VatTotal = 5, GrandTotal = 105, TotalAmount = 105, CreatedBy = TenantAId,
            CreatedAt = now, InvoiceDate = now
        };
        var saleB = new Sale
        {
            TenantId = TenantBId, OwnerId = TenantBId, CustomerId = CustomerBId, InvoiceNo = $"PG-{TenantBId}-B",
            Subtotal = 200, VatTotal = 10, GrandTotal = 210, TotalAmount = 210, CreatedBy = TenantBId,
            CreatedAt = now, InvoiceDate = now
        };
        var saleUnpaidA = new Sale
        {
            TenantId = TenantAId, OwnerId = TenantAId, CustomerId = CustomerAId, InvoiceNo = $"PG-{TenantAId}-UNPAID",
            Subtotal = 57.14m, VatTotal = 2.86m, GrandTotal = 60, TotalAmount = 60, PaidAmount = 0,
            PaymentStatus = SalePaymentStatus.Pending, CreatedBy = TenantAId, CreatedAt = now, InvoiceDate = now
        };
        var saleFin01A = new Sale
        {
            TenantId = TenantAId, OwnerId = TenantAId, CustomerId = CustomerAId, InvoiceNo = $"PG-{TenantAId}-FIN01",
            Subtotal = 1267.62m, VatTotal = 63.38m, GrandTotal = 1331m, TotalAmount = 1331m, PaidAmount = 0,
            PaymentStatus = SalePaymentStatus.Pending, CreatedBy = TenantAId, CreatedAt = now, InvoiceDate = now
        };
        var saleFin02LeaveA = new Sale
        {
            TenantId = TenantAId, OwnerId = TenantAId, CustomerId = CustomerAId, InvoiceNo = $"PG-{TenantAId}-FIN02",
            Subtotal = 1267.62m, VatTotal = 63.38m, GrandTotal = 1331m, TotalAmount = 1331m, PaidAmount = 0,
            PaymentStatus = SalePaymentStatus.Pending, CreatedBy = TenantAId, CreatedAt = now, InvoiceDate = now
        };
        db.Sales.AddRange(saleA, saleB, saleUnpaidA, saleFin01A, saleFin02LeaveA);
        db.SaveChanges();
        SaleAId = saleA.Id;
        SaleBId = saleB.Id;
        SaleUnpaidAId = saleUnpaidA.Id;
        SaleFin01AId = saleFin01A.Id;
        SaleFin02LeaveAId = saleFin02LeaveA.Id;
        paymentA.SaleId = SaleAId;
        paymentB.SaleId = SaleBId;
        var productA = new Product
        {
            TenantId = TenantAId, OwnerId = TenantAId, Sku = $"PG-SKU-{TenantAId}", NameEn = "PG Product A",
            UnitType = "PIECE", ConversionToBase = 1, CreatedAt = now, UpdatedAt = now
        };
        db.Products.Add(productA);
        db.SaveChanges();
        ProductAId = productA.Id;
        db.SaleItems.AddRange(
            new SaleItem
            {
                SaleId = SaleAId, ProductId = productA.Id, UnitType = "PIECE", Qty = 2, UnitPrice = 50, Discount = 0,
                VatAmount = 5, LineTotal = 105, VatRate = 5
            },
            new SaleItem
            {
                SaleId = SaleUnpaidAId, ProductId = productA.Id, UnitType = "PIECE", Qty = 1, UnitPrice = 57.14m,
                Discount = 0, VatAmount = 2.86m, LineTotal = 60, VatRate = 5
            },
            new SaleItem
            {
                SaleId = SaleFin01AId, ProductId = productA.Id, UnitType = "PIECE", Qty = 1, UnitPrice = 1267.62m,
                Discount = 0, VatAmount = 63.38m, LineTotal = 1331m, VatRate = 5
            },
            new SaleItem
            {
                SaleId = SaleFin02LeaveAId, ProductId = productA.Id, UnitType = "PIECE", Qty = 1, UnitPrice = 1267.62m,
                Discount = 0, VatAmount = 63.38m, LineTotal = 1331m, VatRate = 5
            });
        db.SaveChanges();
        var paymentAdj = new Payment
        {
            TenantId = TenantAId, OwnerId = TenantAId, CustomerId = CustomerAId, SaleId = SaleAId, Amount = 1m,
            Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, IsSettlementAdjustment = true,
            CreatedBy = TenantAId, PaymentDate = now, CreatedAt = now
        };
        paymentAdj.ParentPaymentId = PaymentAId;
        db.Payments.Add(paymentAdj);
        db.SaveChanges();
        PaymentAdjustmentAId = paymentAdj.Id;

        var purchaseA = new Purchase
        {
            TenantId = TenantAId, OwnerId = TenantAId, SupplierName = "PG Sup A", InvoiceNo = $"PG-PA-{TenantAId}",
            TotalAmount = 50, PurchaseDate = now, CreatedBy = TenantAId, CreatedAt = now
        };
        var purchaseB = new Purchase
        {
            TenantId = TenantBId, OwnerId = TenantBId, SupplierName = "PG Sup B", InvoiceNo = $"PG-PB-{TenantBId}",
            TotalAmount = 80, PurchaseDate = now, CreatedBy = TenantBId, CreatedAt = now
        };
        db.Purchases.AddRange(purchaseA, purchaseB);
        db.SaveChanges();
        PurchaseAId = purchaseA.Id;
        PurchaseBId = purchaseB.Id;

        var agreementA = new Agreement
        {
            TenantId = TenantAId, OwnerId = TenantAId, AgreementNo = $"PG-AGR-{TenantAId}", AgreementDate = now,
            Status = "Draft", CreatedBy = TenantAId, CreatedAt = now
        };
        var agreementB = new Agreement
        {
            TenantId = TenantBId, OwnerId = TenantBId, AgreementNo = $"PG-AGR-{TenantBId}", AgreementDate = now,
            Status = "Draft", CreatedBy = TenantBId, CreatedAt = now
        };
        db.Agreements.AddRange(agreementA, agreementB);
        var salaryA = new SalaryCertificate
        {
            TenantId = TenantAId, OwnerId = TenantAId, CertificateNo = $"PG-SC-{TenantAId}", CertificateDate = now,
            Status = "Draft", CreatedBy = TenantAId, CreatedAt = now
        };
        var salaryB = new SalaryCertificate
        {
            TenantId = TenantBId, OwnerId = TenantBId, CertificateNo = $"PG-SC-{TenantBId}", CertificateDate = now,
            Status = "Draft", CreatedBy = TenantBId, CreatedAt = now
        };
        db.SalaryCertificates.AddRange(salaryA, salaryB);
        var quoteA = new Quotation
        {
            TenantId = TenantAId, OwnerId = TenantAId, QuoteNo = $"PG-Q-{TenantAId}", QuoteDate = now,
            CustomerId = CustomerAId, Subtotal = 100, VatTotal = 5, GrandTotal = 105, Status = "Draft",
            CreatedBy = TenantAId, CreatedAt = now
        };
        var quoteB = new Quotation
        {
            TenantId = TenantBId, OwnerId = TenantBId, QuoteNo = $"PG-Q-{TenantBId}", QuoteDate = now,
            CustomerId = CustomerBId, Subtotal = 200, VatTotal = 10, GrandTotal = 210, Status = "Draft",
            CreatedBy = TenantBId, CreatedAt = now
        };
        db.Quotations.AddRange(quoteA, quoteB);
        var recurringA = new RecurringInvoice
        {
            TenantId = TenantAId, CustomerId = CustomerAId, Frequency = RecurrenceFrequency.Monthly,
            StartDate = now, NextRunDate = now, CreatedBy = TenantAId, CreatedAt = now, UpdatedAt = now
        };
        var recurringB = new RecurringInvoice
        {
            TenantId = TenantBId, CustomerId = CustomerBId, Frequency = RecurrenceFrequency.Monthly,
            StartDate = now, NextRunDate = now, CreatedBy = TenantBId, CreatedAt = now, UpdatedAt = now
        };
        db.RecurringInvoices.AddRange(recurringA, recurringB);
        db.SaveChanges();
        AgreementAId = agreementA.Id;
        AgreementBId = agreementB.Id;
        SalaryCertificateAId = salaryA.Id;
        SalaryCertificateBId = salaryB.Id;
        QuotationAId = quoteA.Id;
        QuotationBId = quoteB.Id;
        RecurringInvoiceAId = recurringA.Id;
        RecurringInvoiceBId = recurringB.Id;

        SeedTenantStorageFixture();
    }

    private void SeedTenantStorageFixture()
    {
        var logoA = Path.Combine(_storageDataPath, "tenants", TenantAId.ToString(), "logos", "fixture.png");
        var logoB = Path.Combine(_storageDataPath, "tenants", TenantBId.ToString(), "logos", "secret.png");
        Directory.CreateDirectory(Path.GetDirectoryName(logoA)!);
        Directory.CreateDirectory(Path.GetDirectoryName(logoB)!);
        File.WriteAllBytes(logoA, [0x01, 0x02, 0x03]);
        File.WriteAllBytes(logoB, [0x04, 0x05, 0x06]);
    }

    public async Task CleanupTenantDataAsync()
    {
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(_connectionString).Options);
        db.SetRequestTenantScope(null, true);
        await db.Settings.Where(s => s.TenantId == TenantAId || s.TenantId == TenantBId).ExecuteDeleteAsync();
        await db.RecurringInvoices.Where(r => r.TenantId == TenantAId || r.TenantId == TenantBId).ExecuteDeleteAsync();
        await db.SalaryCertificates.Where(s => s.TenantId == TenantAId || s.TenantId == TenantBId).ExecuteDeleteAsync();
        await db.Agreements.Where(a => a.TenantId == TenantAId || a.TenantId == TenantBId).ExecuteDeleteAsync();
        await db.Quotations.Where(q => q.TenantId == TenantAId || q.TenantId == TenantBId).ExecuteDeleteAsync();
        await db.Expenses.Where(e => e.TenantId == TenantAId || e.TenantId == TenantBId).ExecuteDeleteAsync();
        await db.ExpenseCategories.Where(c => c.TenantId == TenantAId || c.TenantId == TenantBId).ExecuteDeleteAsync();
        var purchaseIds = await db.Purchases
            .Where(p => p.TenantId == TenantAId || p.TenantId == TenantBId)
            .Select(p => p.Id)
            .ToListAsync();
        if (purchaseIds.Count > 0)
            await db.PurchaseItems.Where(pi => purchaseIds.Contains(pi.PurchaseId)).ExecuteDeleteAsync();
        await db.Purchases.Where(p => p.TenantId == TenantAId || p.TenantId == TenantBId).ExecuteDeleteAsync();
        await db.Sales.Where(s => s.TenantId == TenantAId || s.TenantId == TenantBId).ExecuteDeleteAsync();
        await db.Payments.Where(p => p.TenantId == TenantAId || p.TenantId == TenantBId).ExecuteDeleteAsync();
        await db.Customers.Where(c => c.TenantId == TenantAId || c.TenantId == TenantBId).ExecuteDeleteAsync();
        await db.Users.Where(u => u.TenantId == TenantAId || u.TenantId == TenantBId).ExecuteDeleteAsync();
        await db.Tenants.Where(t => t.Id == TenantAId || t.Id == TenantBId).ExecuteDeleteAsync();
    }

    public new async ValueTask DisposeAsync()
    {
        try
        {
            await CleanupTenantDataAsync();
            if (Directory.Exists(_storageDataPath))
                Directory.Delete(_storageDataPath, recursive: true);
        }
        catch
        {
            // best-effort cleanup for dedicated test DB rows
        }

        Dispose();
    }

    protected override void Dispose(bool disposing) => base.Dispose(disposing);
}
