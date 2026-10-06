using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace HexaBill.Tests;

/// <summary>
/// Boots the real API pipeline with an isolated SQLite file and background jobs disabled.
/// </summary>
public class HexaBillWebApplicationFactory : WebApplicationFactory<Program>
{
    private static readonly object IntegrationEnvironmentLock = new();

    public const string BackupAgentTokenTenantA = "hbba_test_http_isolation_token_a";
    public const string BackupAgentTokenTenantB = "hbba_test_http_isolation_token_b";
    public const int BackupRunTenantAId = 1;
    public const int BackupRunTenantBId = 2;

    private readonly string _sqlitePath;
    private readonly string _storageDataPath;
    private bool _seeded;

    public HexaBillWebApplicationFactory()
    {
        _sqlitePath = Path.Combine(Path.GetTempPath(), $"hexa-http-{Guid.NewGuid():N}.db");
        _storageDataPath = Path.Combine(Path.GetTempPath(), $"hexa-storage-{Guid.NewGuid():N}");
    }

    private void ApplyIntegrationEnvironment()
    {
        Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", $"Data Source={_sqlitePath}");
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
                ["ConnectionStrings:DefaultConnection"] = $"Data Source={_sqlitePath}",
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
        lock (IntegrationEnvironmentLock)
        {
            ApplyIntegrationEnvironment();
            var host = base.CreateHost(builder);
            if (!_seeded)
            {
                SeedDatabase(host.Services);
                host.Services.GetRequiredService<HexaBill.Api.Core.Infrastructure.DatabaseInitializationStatus>()
                    .CompleteInitialization(hasPendingMigrations: false);
                _seeded = true;
            }

            return host;
        }
    }

    private void SeedDatabase(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.SetRequestTenantScope(null, true);
        db.Database.EnsureDeleted();
        db.Database.EnsureCreated();
        if (db.Tenants.IgnoreQueryFilters().Any())
            return;

        var now = DateTime.UtcNow;
        var closeBusinessDate = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        var closeMovementAt = new DateTime(2026, 10, 3, 12, 0, 0, DateTimeKind.Utc);
        db.Tenants.AddRange(
            new Tenant { Id = 1, Name = "Tenant A", Subdomain = "tenanta", Status = TenantStatus.Active, FeaturesJson = """["daily_close","localBackupAgent","receipt_snapshots","sale_cost_snapshots","settlement_adjustments"]""" },
            new Tenant { Id = 2, Name = "Tenant B", Subdomain = "tenantb", Status = TenantStatus.Active, FeaturesJson = """["daily_close","localBackupAgent"]""" });
        db.Users.AddRange(
            new User
            {
                Id = 1, TenantId = 1, OwnerId = 1, Name = "Owner A", Email = "a@http.test", PasswordHash = "x",
                Role = UserRole.Owner, SessionVersion = 1, IsActive = true, CreatedAt = now
            },
            new User
            {
                Id = 2, TenantId = 2, OwnerId = 2, Name = "Owner B", Email = "b@http.test", PasswordHash = "x",
                Role = UserRole.Owner, SessionVersion = 1, IsActive = true, CreatedAt = now
            });
        db.Branches.AddRange(
            new Branch { Id = 1, TenantId = 1, Name = "Branch A", IsActive = true, CreatedAt = now },
            new Branch { Id = 2, TenantId = 2, Name = "Branch B", IsActive = true, CreatedAt = now });
        db.Routes.AddRange(
            new Route { Id = 1, BranchId = 1, TenantId = 1, Name = "Route A", IsActive = true, CreatedAt = now },
            new Route { Id = 2, BranchId = 2, TenantId = 2, Name = "Route B", IsActive = true, CreatedAt = now });
        db.Customers.AddRange(
            new Customer { Id = 1, TenantId = 1, OwnerId = 1, Name = "Cust A", CreatedAt = now, UpdatedAt = now },
            new Customer { Id = 2, TenantId = 2, OwnerId = 2, Name = "Cust B", CreatedAt = now, UpdatedAt = now });
        db.Payments.AddRange(
            new Payment
            {
                Id = 1, TenantId = 1, OwnerId = 1, CustomerId = 1, SaleId = 1, Amount = 50, Mode = PaymentMode.CASH,
                Status = PaymentStatus.CLEARED, CreatedBy = 1, PaymentDate = now, CreatedAt = now
            },
            new Payment
            {
                Id = 2, TenantId = 2, OwnerId = 2, CustomerId = 2, Amount = 75, Mode = PaymentMode.CASH,
                Status = PaymentStatus.CLEARED, CreatedBy = 2, PaymentDate = now, CreatedAt = now
            },
            new Payment
            {
                Id = 3, TenantId = 1, OwnerId = 1, CustomerId = 1, SaleId = 1, Amount = 1, Mode = PaymentMode.CASH,
                Status = PaymentStatus.CLEARED, IsSettlementAdjustment = true, ParentPaymentId = 1, CreatedBy = 1, PaymentDate = now, CreatedAt = now
            });
        db.PaymentReceipts.AddRange(
            new PaymentReceipt
            {
                Id = 1, TenantId = 1, PaymentId = 1, ReceiptNumber = "REC-A-1", GeneratedAt = now, GeneratedByUserId = 1
            },
            new PaymentReceipt
            {
                Id = 2, TenantId = 2, PaymentId = 2, ReceiptNumber = "REC-B-1", GeneratedAt = now, GeneratedByUserId = 2
            });
        db.Sales.AddRange(
            new Sale
            {
                Id = 1, TenantId = 1, OwnerId = 1, CustomerId = 1, InvoiceNo = "A-1001",
                Subtotal = 100, VatTotal = 5, GrandTotal = 105, TotalAmount = 105, CreatedBy = 1,
                CreatedAt = now, InvoiceDate = now
            },
            new Sale
            {
                Id = 2, TenantId = 2, OwnerId = 2, CustomerId = 2, InvoiceNo = "B-2001",
                Subtotal = 200, VatTotal = 10, GrandTotal = 210, TotalAmount = 210, CreatedBy = 2,
                CreatedAt = now, InvoiceDate = now
            },
            new Sale
            {
                Id = 3, TenantId = 1, OwnerId = 1, CustomerId = 1, InvoiceNo = "A-1002",
                Subtotal = 76.19m, VatTotal = 3.81m, GrandTotal = 80, TotalAmount = 80, PaidAmount = 0,
                PaymentStatus = SalePaymentStatus.Pending, CreatedBy = 1, CreatedAt = now, InvoiceDate = now
            },
            new Sale
            {
                Id = 4, TenantId = 1, OwnerId = 1, CustomerId = 1, InvoiceNo = "A-1003",
                Subtotal = 47.62m, VatTotal = 2.38m, GrandTotal = 50, TotalAmount = 50, PaidAmount = 0,
                PaymentStatus = SalePaymentStatus.Pending, CreatedBy = 1, CreatedAt = now, InvoiceDate = now
            },
            new Sale
            {
                Id = 5, TenantId = 1, OwnerId = 1, CustomerId = 1, InvoiceNo = "A-1004",
                Subtotal = 57.14m, VatTotal = 2.86m, GrandTotal = 60, TotalAmount = 60, PaidAmount = 0,
                PaymentStatus = SalePaymentStatus.Pending, CreatedBy = 1, CreatedAt = now, InvoiceDate = now
            },
            new Sale
            {
                Id = 6, TenantId = 1, OwnerId = 1, CustomerId = 1, InvoiceNo = "A-1005",
                Subtotal = 66.67m, VatTotal = 3.33m, GrandTotal = 70, TotalAmount = 70, PaidAmount = 0,
                PaymentStatus = SalePaymentStatus.Pending, CreatedBy = 1, CreatedAt = now, InvoiceDate = now
            },
            new Sale
            {
                Id = 7, TenantId = 1, OwnerId = 1, CustomerId = 1, InvoiceNo = "A-FIN01",
                Subtotal = 1267.62m, VatTotal = 63.38m, GrandTotal = 1331m, TotalAmount = 1331m, PaidAmount = 0,
                PaymentStatus = SalePaymentStatus.Pending, CreatedBy = 1, CreatedAt = now, InvoiceDate = now
            },
            new Sale
            {
                Id = 8, TenantId = 1, OwnerId = 1, CustomerId = 1, InvoiceNo = "A-FIN01-DEL",
                Subtotal = 1267.62m, VatTotal = 63.38m, GrandTotal = 1331m, TotalAmount = 1331m, PaidAmount = 0,
                PaymentStatus = SalePaymentStatus.Pending, CreatedBy = 1, CreatedAt = now, InvoiceDate = now
            },
            new Sale
            {
                Id = 9, TenantId = 1, OwnerId = 1, CustomerId = 1, InvoiceNo = "A-FIN01-UPD",
                Subtotal = 1267.62m, VatTotal = 63.38m, GrandTotal = 1331m, TotalAmount = 1331m, PaidAmount = 0,
                PaymentStatus = SalePaymentStatus.Pending, CreatedBy = 1, CreatedAt = now, InvoiceDate = now
            },
            new Sale
            {
                Id = 10, TenantId = 1, OwnerId = 1, CustomerId = 1, InvoiceNo = "A-FIN02-LEAVE",
                Subtotal = 1267.62m, VatTotal = 63.38m, GrandTotal = 1331m, TotalAmount = 1331m, PaidAmount = 0,
                PaymentStatus = SalePaymentStatus.Pending, CreatedBy = 1, CreatedAt = now, InvoiceDate = now
            });
        db.SaleItems.AddRange(
            new SaleItem
            {
                Id = 1, SaleId = 1, ProductId = 1, UnitType = "PIECE", Qty = 2, UnitPrice = 50, Discount = 0,
                VatAmount = 5, LineTotal = 105, VatRate = 5
            },
            new SaleItem
            {
                Id = 2, SaleId = 2, ProductId = 2, UnitType = "PIECE", Qty = 1, UnitPrice = 200, Discount = 0,
                VatAmount = 10, LineTotal = 210, VatRate = 5
            },
            new SaleItem
            {
                Id = 3, SaleId = 3, ProductId = 1, UnitType = "PIECE", Qty = 1, UnitPrice = 76.19m, Discount = 0,
                VatAmount = 3.81m, LineTotal = 80, VatRate = 5
            },
            new SaleItem
            {
                Id = 4, SaleId = 4, ProductId = 1, UnitType = "PIECE", Qty = 1, UnitPrice = 47.62m, Discount = 0,
                VatAmount = 2.38m, LineTotal = 50, VatRate = 5
            },
            new SaleItem
            {
                Id = 5, SaleId = 5, ProductId = 1, UnitType = "PIECE", Qty = 1, UnitPrice = 57.14m, Discount = 0,
                VatAmount = 2.86m, LineTotal = 60, VatRate = 5
            },
            new SaleItem
            {
                Id = 6, SaleId = 6, ProductId = 1, UnitType = "PIECE", Qty = 1, UnitPrice = 66.67m, Discount = 0,
                VatAmount = 3.33m, LineTotal = 70, VatRate = 5
            },
            new SaleItem
            {
                Id = 7, SaleId = 7, ProductId = 1, UnitType = "PIECE", Qty = 1, UnitPrice = 1267.62m, Discount = 0,
                VatAmount = 63.38m, LineTotal = 1331m, VatRate = 5
            },
            new SaleItem
            {
                Id = 8, SaleId = 8, ProductId = 1, UnitType = "PIECE", Qty = 1, UnitPrice = 1267.62m, Discount = 0,
                VatAmount = 63.38m, LineTotal = 1331m, VatRate = 5
            },
            new SaleItem
            {
                Id = 9, SaleId = 9, ProductId = 1, UnitType = "PIECE", Qty = 1, UnitPrice = 1267.62m, Discount = 0,
                VatAmount = 63.38m, LineTotal = 1331m, VatRate = 5
            },
            new SaleItem
            {
                Id = 10, SaleId = 10, ProductId = 1, UnitType = "PIECE", Qty = 1, UnitPrice = 1267.62m, Discount = 0,
                VatAmount = 63.38m, LineTotal = 1331m, VatRate = 5
            });
        db.Suppliers.AddRange(
            new Supplier
            {
                Id = 1, TenantId = 1, Name = "Sup A", NormalizedName = "sup a", IsActive = true, CreatedAt = now
            },
            new Supplier
            {
                Id = 2, TenantId = 2, Name = "Sup B", NormalizedName = "sup b", IsActive = true, CreatedAt = now
            });
        db.Purchases.AddRange(
            new Purchase
            {
                Id = 1, TenantId = 1, OwnerId = 1, SupplierName = "Sup A", InvoiceNo = "PA-1",
                TotalAmount = 50, PurchaseDate = now, CreatedBy = 1, CreatedAt = now
            },
            new Purchase
            {
                Id = 2, TenantId = 2, OwnerId = 2, SupplierName = "Sup B", InvoiceNo = "PB-1",
                TotalAmount = 80, PurchaseDate = now, CreatedBy = 2, CreatedAt = now
            });
        db.Products.AddRange(
            new Product
            {
                Id = 1, TenantId = 1, OwnerId = 1, Sku = "A-SKU", NameEn = "Prod A", UnitType = "PIECE",
                ConversionToBase = 1, StockQty = 100, CostPrice = 40, SellPrice = 50, CreatedAt = now, UpdatedAt = now
            },
            new Product
            {
                Id = 2, TenantId = 2, OwnerId = 2, Sku = "B-SKU", NameEn = "Prod B", UnitType = "PIECE",
                ConversionToBase = 1, CreatedAt = now, UpdatedAt = now
            });
        db.ExpenseCategories.AddRange(
            new ExpenseCategory { Id = 1, TenantId = 1, Name = "Cat A", CreatedAt = now },
            new ExpenseCategory { Id = 2, TenantId = 2, Name = "Cat B", CreatedAt = now });
        db.Expenses.AddRange(
            new Expense
            {
                Id = 1, TenantId = 1, OwnerId = 1, CategoryId = 1, Amount = 10, Date = now, CreatedBy = 1,
                CreatedAt = now, Status = ExpenseStatus.Approved
            },
            new Expense
            {
                Id = 2, TenantId = 2, OwnerId = 2, CategoryId = 2, Amount = 20, Date = now, CreatedBy = 2,
                CreatedAt = now, Status = ExpenseStatus.Approved
            });
        db.SaleReturns.AddRange(
            new SaleReturn
            {
                Id = 1, TenantId = 1, OwnerId = 1, SaleId = 1, CustomerId = 1, ReturnNo = "RA-1", ReturnDate = now,
                CreatedAt = now, CreatedBy = 1, Status = ReturnStatus.Pending, GrandTotal = 10
            },
            new SaleReturn
            {
                Id = 2, TenantId = 2, OwnerId = 2, SaleId = 2, CustomerId = 2, ReturnNo = "RB-1", ReturnDate = now,
                CreatedAt = now, CreatedBy = 2, Status = ReturnStatus.Pending, GrandTotal = 20
            });
        db.CashDrawerMovements.AddRange(
            new CashDrawerMovement
            {
                Id = 1, TenantId = 1, OwnerId = 1, Amount = 100m, Kind = CashDrawerMovementKind.OwnerCapitalIn,
                MovementDate = closeMovementAt, CreatedByUserId = 1, CreatedAt = now
            },
            new CashDrawerMovement
            {
                Id = 2, TenantId = 2, OwnerId = 2, Amount = 50m, Kind = CashDrawerMovementKind.OwnerCapitalIn,
                MovementDate = closeMovementAt, CreatedByUserId = 2, CreatedAt = now
            });
        db.DailyCashCloses.AddRange(
            new DailyCashClose
            {
                Id = 1, TenantId = 1, OwnerId = 1, BusinessDate = closeBusinessDate, Version = 1,
                Status = DailyCashCloseStatus.Draft, OpeningCash = 0, ExpectedCash = 0, CountedCash = 0, Variance = 0,
                CreatedByUserId = 1, CreatedAt = now, UpdatedAt = now
            },
            new DailyCashClose
            {
                Id = 2, TenantId = 2, OwnerId = 2, BusinessDate = closeBusinessDate, Version = 1,
                Status = DailyCashCloseStatus.Draft, OpeningCash = 0, ExpectedCash = 0, CountedCash = 0, Variance = 0,
                CreatedByUserId = 2, CreatedAt = now, UpdatedAt = now
            });
        db.Settings.AddRange(
            new Setting
            {
                TenantId = 1, OwnerId = 1, Key = "COMPANY_TRN", Value = "100000000000001",
                CreatedAt = now, UpdatedAt = now
            },
            new Setting
            {
                TenantId = 1, OwnerId = 1, Key = "COMPANY_NAME_EN", Value = "Tenant A Legal Name",
                CreatedAt = now, UpdatedAt = now
            },
            new Setting
            {
                TenantId = 2, OwnerId = 2, Key = "COMPANY_TRN", Value = "100000000000002",
                CreatedAt = now, UpdatedAt = now
            },
            new Setting
            {
                TenantId = 2, OwnerId = 2, Key = "COMPANY_NAME_EN", Value = "Tenant B Legal Name",
                CreatedAt = now, UpdatedAt = now
            });
        db.Alerts.AddRange(
            new Alert
            {
                Id = 1, TenantId = 1, OwnerId = 1, Type = "LowStock", Title = "Tenant A alert",
                Severity = "Info", CreatedAt = now
            },
            new Alert
            {
                Id = 2, TenantId = 2, OwnerId = 2, Type = "LowStock", Title = "Tenant B alert",
                Severity = "Info", CreatedAt = now
            });
        db.SalaryCertificates.AddRange(
            new SalaryCertificate
            {
                Id = 1, TenantId = 1, OwnerId = 1, CertificateNo = "SC-A-HTTP-1", CertificateDate = now,
                Status = "Draft", CreatedBy = 1, CreatedAt = now
            },
            new SalaryCertificate
            {
                Id = 2, TenantId = 2, OwnerId = 2, CertificateNo = "SC-B-HTTP-1", CertificateDate = now,
                Status = "Draft", CreatedBy = 2, CreatedAt = now
            });
        db.Agreements.AddRange(
            new Agreement
            {
                Id = 1, TenantId = 1, OwnerId = 1, AgreementNo = "AGR-A-HTTP-1", AgreementDate = now,
                Status = "Draft", CreatedBy = 1, CreatedAt = now
            },
            new Agreement
            {
                Id = 2, TenantId = 2, OwnerId = 2, AgreementNo = "AGR-B-HTTP-1", AgreementDate = now,
                Status = "Draft", CreatedBy = 2, CreatedAt = now
            });
        db.Quotations.AddRange(
            new Quotation
            {
                Id = 1, TenantId = 1, OwnerId = 1, QuoteNo = "Q-A-HTTP-1", QuoteDate = now, CustomerId = 1,
                Subtotal = 100, VatTotal = 5, GrandTotal = 105, Status = "Draft", CreatedBy = 1, CreatedAt = now
            },
            new Quotation
            {
                Id = 2, TenantId = 2, OwnerId = 2, QuoteNo = "Q-B-HTTP-1", QuoteDate = now, CustomerId = 2,
                Subtotal = 200, VatTotal = 10, GrandTotal = 210, Status = "Draft", CreatedBy = 2, CreatedAt = now
            });
        db.RecurringInvoices.AddRange(
            new RecurringInvoice
            {
                Id = 1, TenantId = 1, CustomerId = 1, Frequency = RecurrenceFrequency.Monthly,
                StartDate = now, NextRunDate = now, CreatedBy = 1, CreatedAt = now, UpdatedAt = now
            },
            new RecurringInvoice
            {
                Id = 2, TenantId = 2, CustomerId = 2, Frequency = RecurrenceFrequency.Monthly,
                StartDate = now, NextRunDate = now, CreatedBy = 2, CreatedAt = now, UpdatedAt = now
            });
        SeedSharedLegalSourceTenant(db, now);
        SeedBackupAgentFixtures(db, now);
        db.SaveChanges();
        SeedTenantStorageFixture();
    }

    /// <summary>Legal-identity source for shared-owner HTTP provisioning tests (id 5).</summary>
    private static void SeedSharedLegalSourceTenant(AppDbContext db, DateTime now)
    {
        const int sourceId = 5;
        db.Tenants.Add(new Tenant
        {
            Id = sourceId, Name = "Legal Trading Company", CompanyNameEn = "Registered Trading LLC",
            Subdomain = "legal-source", Country = "AE", Currency = "AED", VatNumber = "100123456789012",
            Email = "first@example.com", Phone = "+971501111111", Status = TenantStatus.Active,
            FeaturesJson = """["shared_legal_workspace"]"""
        });
        foreach (var (key, value) in new Dictionary<string, string>
                 {
                     ["COMPANY_NAME_EN"] = "Registered Trading LLC",
                     ["COMPANY_TRN"] = "100123456789012",
                     ["COMPANY_LICENSE"] = "LIC-123",
                     ["BANK_ACCOUNT"] = "Owner one private bank",
                     ["INVOICE_PREFIX"] = "OWNER1",
                 })
        {
            db.Settings.Add(new Setting { TenantId = sourceId, OwnerId = sourceId, Key = key, Value = value });
        }

        db.Users.Add(new User
        {
            Id = sourceId, TenantId = sourceId, OwnerId = sourceId, Name = "First Owner",
            Email = "first@example.com", PasswordHash = "x", Role = UserRole.Owner, SessionVersion = 1,
            IsActive = true, CreatedAt = now
        });
        db.Products.Add(new Product
        {
            Id = 50, TenantId = sourceId, OwnerId = sourceId, NameEn = "Source private stock", Sku = "SOURCE",
            UnitType = "PIECE", ConversionToBase = 1, StockQty = 8, CreatedAt = now, UpdatedAt = now
        });
        db.Customers.Add(new Customer
        {
            Id = 50, TenantId = sourceId, OwnerId = sourceId, Name = "Source private customer", CreatedAt = now,
            UpdatedAt = now
        });
        db.Sales.Add(new Sale
        {
            Id = 50, TenantId = sourceId, OwnerId = sourceId, CustomerId = 50, InvoiceNo = "OWNER1-1",
            GrandTotal = 1331m, Subtotal = 1331m, TotalAmount = 1331m, CreatedAt = now, InvoiceDate = now,
            CreatedBy = sourceId
        });
    }

    private static void SeedBackupAgentFixtures(AppDbContext db, DateTime now)
    {
        db.BackupDevices.AddRange(
            new BackupDevice { Id = 1, TenantId = 1, CreatedByUserId = 1, DisplayName = "PC A", CreatedAt = now },
            new BackupDevice { Id = 2, TenantId = 2, CreatedByUserId = 2, DisplayName = "PC B", CreatedAt = now });
        db.BackupDeviceTokens.AddRange(
            new BackupDeviceToken
            {
                TenantId = 1, DeviceId = 1, TokenHash = BackupAgentSecrets.Hash(BackupAgentTokenTenantA),
                ExpiresAt = now.AddDays(30), CreatedAt = now
            },
            new BackupDeviceToken
            {
                TenantId = 2, DeviceId = 2, TokenHash = BackupAgentSecrets.Hash(BackupAgentTokenTenantB),
                ExpiresAt = now.AddDays(30), CreatedAt = now
            });
        db.BackupRuns.AddRange(
            new BackupRun
            {
                Id = BackupRunTenantAId, TenantId = 1, DeviceId = 1, SlotKey = "2026-10-03",
                Status = BackupRunStatus.Ready, FileName = "tenant-a.zip", DownloadName = "a.zip", StartedAt = now
            },
            new BackupRun
            {
                Id = BackupRunTenantBId, TenantId = 2, DeviceId = 2, SlotKey = "2026-10-03",
                Status = BackupRunStatus.Ready, FileName = "tenant-b.zip", DownloadName = "b.zip", StartedAt = now
            });
    }

    private void SeedTenantStorageFixture()
    {
        var logoA = Path.Combine(_storageDataPath, "tenants", "1", "logos", "fixture.png");
        var logoB = Path.Combine(_storageDataPath, "tenants", "2", "logos", "secret.png");
        Directory.CreateDirectory(Path.GetDirectoryName(logoA)!);
        Directory.CreateDirectory(Path.GetDirectoryName(logoB)!);
        File.WriteAllBytes(logoA, [0x01, 0x02, 0x03]);
        File.WriteAllBytes(logoB, [0x04, 0x05, 0x06]);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            try
            {
                if (File.Exists(_sqlitePath))
                    File.Delete(_sqlitePath);
                if (Directory.Exists(_storageDataPath))
                    Directory.Delete(_storageDataPath, recursive: true);
            }
            catch
            {
                // best-effort temp cleanup
            }
        }

        base.Dispose(disposing);
    }
}
