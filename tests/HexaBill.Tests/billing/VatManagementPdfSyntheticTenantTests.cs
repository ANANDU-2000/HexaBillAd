using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using HexaBill.Api.Modules.Reports;
using HexaBill.Api.Core.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Microsoft.Extensions.Logging.Abstractions;
using UglyToad.PdfPig;

namespace HexaBill.Tests;

// Serialized: these tests read or set process-wide environment (DATA_PATH, ASPNETCORE_ENVIRONMENT) used by PDF/TRN code.
[Collection("HttpIntegration")]
public sealed class VatManagementPdfSyntheticTenantTests
{
    [Fact]
    public async Task ManagementPdf_RendersSeparateSyntheticTenantReports()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"vat-pdf-synthetic-{Guid.NewGuid():N}").Options;
        await using var context = new AppDbContext(options);
        context.SetRequestTenantScope(null, isPlatformScope: true);
        var clients = new[] { (Id: 88701, Slug: "gulfharvest", Name: "Gulf Harvest"),
            (Id: 88702, Slug: "frozenhub1", Name: "FrozenHub1"),
            (Id: 88703, Slug: "frozenhub2", Name: "FrozenHub2") };
        foreach (var client in clients)
        {
            context.Tenants.Add(new Tenant
            {
                Id = client.Id, Name = client.Name, CompanyNameEn = client.Name,
                Subdomain = $"vatpdf{client.Id}", Country = "AE", Currency = "AED"
            });
            context.Settings.Add(new Setting
            {
                TenantId = client.Id, OwnerId = client.Id, Key = "COMPANY_NAME_EN", Value = client.Name
            });
            context.Settings.Add(new Setting
            {
                TenantId = client.Id, OwnerId = client.Id, Key = "COMPANY_ADDRESS", Value = $"{client.Name} Synthetic Address"
            });
            context.Settings.Add(new Setting
            {
                TenantId = client.Id, OwnerId = client.Id, Key = "COMPANY_PHONE", Value = "+971500000000"
            });
        }
        await context.SaveChangesAsync();

        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        var pdf = new PdfService(context, null!, fonts, new SettingsService(context), null!,
            NullLogger<PdfService>.Instance, null!);
        var outputDirectory = Environment.GetEnvironmentVariable("HEXABILL_PDF_EVIDENCE_DIR");
        foreach (var client in clients)
        {
            context.SetRequestTenantScope(client.Id, isPlatformScope: false);
            var bytes = await pdf.GenerateVatManagementReportPdfAsync(new VatReturn201Dto
            {
                CompanyName = client.Name, PeriodLabel = "Q3-2026",
                PeriodStart = new DateTime(2026, 8, 1), PeriodEnd = new DateTime(2026, 10, 31),
                Status = "Draft", StandardOutputVat = 5m, RecoverableInputVat = 2m,
                VatTrn = "100000000000099", TrnStatus = "TRN not verified",
                Address = $"{client.Name} Synthetic Address", Phone = "+971500000000",
                NetVatPayable = 3m,
                OutputLines = [new VatReturnOutputLineDto { Reference = $"{client.Slug}-sale-1", Date = new DateTime(2026, 9, 1), NetAmount = 100m, VatAmount = 5m, CustomerName = $"{client.Name} Customer" }],
                InputLines = [new VatReturnInputLineDto { Reference = $"{client.Slug}-purchase-1", Date = new DateTime(2026, 9, 2), NetAmount = 40m, VatAmount = 2m, ClaimableVat = 2m }]
            }, client.Id);
            Assert.True(bytes.Length > 700);
            Assert.StartsWith("%PDF-", System.Text.Encoding.ASCII.GetString(bytes, 0, 5));
            using (var document = PdfDocument.Open(new MemoryStream(bytes)))
            {
                var text = string.Join("\n", document.GetPages().Select(page => page.Text));
                Assert.Contains("TRN not verified", text);
                Assert.Contains("Synthetic Address", text);
                Assert.Contains("971500000000", text);
                Assert.Contains($"{client.Slug}-sale-1", text);
                foreach (var otherTenant in clients.Where(other => other.Id != client.Id))
                {
                    Assert.DoesNotContain($"{otherTenant.Slug}-sale-1", text, StringComparison.Ordinal);
                    Assert.DoesNotContain($"{otherTenant.Slug}-purchase-1", text, StringComparison.Ordinal);
                    Assert.DoesNotContain($"{otherTenant.Name} Customer", text, StringComparison.Ordinal);
                }
            }
            if (!string.IsNullOrWhiteSpace(outputDirectory))
            {
                Directory.CreateDirectory(outputDirectory);
                await File.WriteAllBytesAsync(Path.Combine(outputDirectory,
                    $"vat-management-{client.Slug}-synthetic-draft.pdf"), bytes);
            }
        }
    }

    [Fact]
    public async Task ManagementPdf_ExtractedHeadersTotalsAndRepeatedMultiPageHeaderMatchScreenDto()
    {
        await using var context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"vat-pdf-pages-{Guid.NewGuid():N}").Options);
        context.SetRequestTenantScope(null, isPlatformScope: true);
        const int tenantId = 88901;
        context.Tenants.Add(new Tenant
        {
            Id = tenantId, Name = "Synthetic Fixture A", CompanyNameEn = "Synthetic Fixture A",
            Subdomain = "vat-pdf-fixture-a", Country = "AE", Currency = "AED"
        });
        context.Settings.AddRange(
            new Setting { TenantId = tenantId, OwnerId = tenantId, Key = "COMPANY_NAME_EN", Value = "Synthetic Fixture A" },
            new Setting { TenantId = tenantId, OwnerId = tenantId, Key = "COMPANY_ADDRESS", Value = "Fixture Address, Dubai" },
            new Setting { TenantId = tenantId, OwnerId = tenantId, Key = "COMPANY_PHONE", Value = "+971500000001" });
        await context.SaveChangesAsync();
        context.SetRequestTenantScope(tenantId, isPlatformScope: false);

        var output = Enumerable.Range(1, 60).Select(index => new VatReturnOutputLineDto
        {
            Reference = $"FIX-A-SALE-{index:000}", Date = new DateTime(2026, 9, 1).AddDays(index - 1),
            CustomerName = $"Fixture Customer {index:000}", NetAmount = 100m, VatAmount = 5m
        }).ToList();
        var report = new VatReturn201Dto
        {
            CompanyName = "Synthetic Fixture A", Address = "Fixture Address, Dubai", Phone = "+971500000001",
            VatTrn = "100000000000099", TrnStatus = "TRN not verified", CanFreezeVatReport = true,
            PeriodLabel = "Sep-2026", PeriodStart = new DateTime(2026, 9, 1), PeriodEnd = new DateTime(2026, 9, 30),
            Status = "Draft", StandardOutputVat = 300m, RecoverableInputVat = 20m, NetVatPayable = 280m,
            OutputLines = output,
            InputLines =
            [
                new VatReturnInputLineDto { Type = "Purchase", Reference = "FIX-A-PURCHASE", Date = new DateTime(2026, 9, 2), SupplierName = "Fixture Supplier", NetAmount = 400m, VatAmount = 20m, ClaimableVat = 20m },
                new VatReturnInputLineDto { Type = "Expense", Reference = "FIX-A-EXPENSE", Date = new DateTime(2026, 9, 3), CategoryName = "Office", NetAmount = 100m, VatAmount = 5m, ClaimableVat = 5m }
            ],
            CreditNoteLines =
            [
                new VatReturnCreditNoteLineDto { Side = "Output", Reference = "FIX-A-SALE-RETURN", Date = new DateTime(2026, 9, 4), NetAmount = 200m, VatAmount = 10m },
                new VatReturnCreditNoteLineDto { Side = "Input", Reference = "FIX-A-PURCHASE-RETURN", Date = new DateTime(2026, 9, 5), NetAmount = 100m, VatAmount = 5m }
            ]
        };

        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        var pdf = new PdfService(context, null!, fonts, new SettingsService(context), null!,
            NullLogger<PdfService>.Instance, null!);
        var bytes = await pdf.GenerateVatManagementReportPdfAsync(report, tenantId);
        var evidenceDirectory = Environment.GetEnvironmentVariable("HEXABILL_PDF_EVIDENCE_DIR");
        if (!string.IsNullOrWhiteSpace(evidenceDirectory))
        {
            Directory.CreateDirectory(evidenceDirectory);
            await File.WriteAllBytesAsync(Path.Combine(evidenceDirectory, "vat-management-fixture-a-multipage.pdf"), bytes);
        }
        using var document = PdfDocument.Open(new MemoryStream(bytes));
        var pages = document.GetPages().ToList();
        Assert.True(pages.Count >= 2, $"Expected 60 detail rows to span pages; got {pages.Count} page(s).");
        var repeatedHeaderPages = pages.Count(page =>
            page.Text.Contains("Reference", StringComparison.Ordinal)
            && page.Text.Contains("Date", StringComparison.Ordinal)
            && page.Text.Contains("Party", StringComparison.Ordinal)
            && page.Text.Contains("Taxable", StringComparison.Ordinal)
            && page.Text.Contains("VAT", StringComparison.Ordinal)
            && page.Text.Contains("Total", StringComparison.Ordinal));
        Assert.True(repeatedHeaderPages >= 2, $"Expected repeated six-column headers on multiple pages; got {repeatedHeaderPages}.");

        var extracted = string.Join("\n", pages.Select(page => page.Text));
        foreach (var header in new[] { "Reference", "Date", "Party", "Taxable", "VAT", "Total" })
            Assert.Contains(header, extracted);
        Assert.Contains("FIX-A-PURCHASE", extracted);
        Assert.Contains("FIX-A-EXPENSE", extracted);
        Assert.Contains("FIX-A-SALE-RETURN", extracted);
        Assert.Contains("FIX-A-PURCHASE-RETURN", extracted);
        Assert.Contains("TRN not verified", extracted);
        Assert.Contains("Period:", extracted);
        Assert.Contains("01-Sept-2026 to 30-Sept-2026", extracted);
        Assert.Contains("Status: Draft", extracted);
        Assert.Contains("Page 1 of", extracted);
        Assert.Matches(@"Page 1 of \d+", extracted);
        Assert.Contains("GST", extracted);
        Assert.Contains(report.StandardOutputVat.ToString("N2"), extracted);
        Assert.Contains(report.RecoverableInputVat.ToString("N2"), extracted);
        Assert.Contains(report.NetVatPayable.ToString("N2"), extracted);
        Assert.Contains("300.00", extracted); // 60 x AED 5 output VAT, table footer.
        Assert.Contains("6,000.00", extracted); // 60 x AED 100 taxable value, table footer.
        Assert.Contains("400.00", extracted); // Purchases table taxable total.
        Assert.Contains("420.00", extracted); // Purchases table gross total.
        Assert.Contains("100.00", extracted); // Expenses table taxable total.
        Assert.Contains("105.00", extracted); // Expenses table gross total.
        Assert.Contains("-300.00", extracted); // Output and input credit-note taxable totals combined in text.
        Assert.Contains("-315.00", extracted); // Credit notes table gross total.
    }

    [Fact]
    public async Task AllThreeSyntheticTenants_ReportExportLockBlockWriteAndAmendIndependently()
    {
        await using var context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"vat-full-journey-{Guid.NewGuid():N}").Options);
        context.SetRequestTenantScope(null, isPlatformScope: true);
        var tenants = new[] { (Id: 89101, Slug: "gulfharvest", Name: "Gulf Harvest", Trn: "100000000000101"),
            (Id: 89102, Slug: "frozenhub1", Name: "FrozenHub1", Trn: "100000000000102"),
            (Id: 89103, Slug: "frozenhub2", Name: "FrozenHub2", Trn: "100000000000102") };
        foreach (var tenant in tenants)
        {
            context.Tenants.Add(new Tenant
            {
                Id = tenant.Id, Name = tenant.Name, CompanyNameEn = tenant.Name,
                Subdomain = $"vatjourney-{tenant.Slug}", Country = "AE", Currency = "AED"
            });
            context.Settings.AddRange(
                new Setting { TenantId = tenant.Id, OwnerId = tenant.Id, Key = "COMPANY_NAME_EN", Value = tenant.Name },
                new Setting { TenantId = tenant.Id, OwnerId = tenant.Id, Key = "COMPANY_TRN", Value = tenant.Trn },
                new Setting { TenantId = tenant.Id, OwnerId = tenant.Id, Key = "COMPANY_ADDRESS", Value = $"{tenant.Name} Address" },
                new Setting { TenantId = tenant.Id, OwnerId = tenant.Id, Key = "COMPANY_PHONE", Value = $"+971500000{tenant.Id % 1000:000}" });
            context.Sales.Add(new Sale
            {
                TenantId = tenant.Id, OwnerId = tenant.Id, InvoiceNo = $"{tenant.Slug}-SALE-1",
                InvoiceDate = new DateTime(2025, 1, 15, 12, 0, 0, DateTimeKind.Utc),
                Subtotal = 1_000m, VatTotal = 50m, GrandTotal = 1_050m,
                VatScenario = "Standard", IsDeleted = false, IsZeroInvoice = false, CreatedBy = tenant.Id
            });
        }
        await context.SaveChangesAsync();

        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        var pdfService = new PdfService(context, null!, fonts, new SettingsService(context), null!,
            NullLogger<PdfService>.Instance, null!);
        foreach (var tenant in tenants)
        {
            context.SetRequestTenantScope(tenant.Id, isPlatformScope: false);
            var controller = CreateTenantController(context, tenant.Id);
            var screenResult = await controller.GetVatReturn(new DateTime(2025, 1, 1), new DateTime(2025, 3, 31), null, null);
            var screen = Assert.IsType<ApiResponse<VatReturn201Dto>>(Assert.IsType<OkObjectResult>(screenResult.Result).Value).Data!;
            Assert.Equal(50m, screen.StandardOutputVat);
            Assert.Single(screen.OutputLines);
            Assert.Equal($"{tenant.Slug}-SALE-1", screen.OutputLines[0].Reference);

            var excel = Assert.IsType<FileContentResult>(await controller.ExportVatManagementExcel(
                new DateTime(2025, 1, 1), new DateTime(2025, 3, 31), null));
            OfficeOpenXml.ExcelPackage.LicenseContext = OfficeOpenXml.LicenseContext.NonCommercial;
            using (var package = new OfficeOpenXml.ExcelPackage(new MemoryStream(excel.FileContents)))
            {
                var summary = package.Workbook.Worksheets["Management Summary"]!;
                Assert.Equal(screen.StandardOutputVat, summary.Cells[5, 2].GetValue<decimal>());
                Assert.Equal(screen.RecoverableInputVat, summary.Cells[6, 2].GetValue<decimal>());
                Assert.Equal(screen.NetVatPayable, summary.Cells[7, 2].GetValue<decimal>());
                Assert.Contains(tenant.Name, summary.Cells[2, 2].Text);
                Assert.Equal($"{tenant.Slug}-SALE-1", package.Workbook.Worksheets["Sales"]!.Cells[2, 1].Text);
            }
            var csv = Assert.IsType<FileContentResult>(await controller.ExportVatManagementCsv(
                new DateTime(2025, 1, 1), new DateTime(2025, 3, 31), null));
            var csvText = System.Text.Encoding.UTF8.GetString(csv.FileContents);
            Assert.Contains($"StandardOutputVat,{screen.StandardOutputVat}", csvText);
            Assert.Contains($"RecoverableInputVat,{screen.RecoverableInputVat}", csvText);
            Assert.Contains($"NetVatPayable,{screen.NetVatPayable}", csvText);
            Assert.Contains($"{tenant.Slug}-SALE-1", csvText);
            foreach (var other in tenants.Where(other => other.Id != tenant.Id))
                Assert.DoesNotContain($"{other.Slug}-SALE-1", csvText, StringComparison.Ordinal);

            var pdfBytes = await pdfService.GenerateVatManagementReportPdfAsync(screen, tenant.Id);
            using (var pdf = PdfDocument.Open(new MemoryStream(pdfBytes)))
            {
                var text = string.Join("\n", pdf.GetPages().Select(page => page.Text));
                Assert.Contains(tenant.Name, text);
                Assert.Contains($"{tenant.Slug}-SALE-1", text);
                Assert.Contains(screen.StandardOutputVat.ToString("N2"), text);
                Assert.Contains(screen.RecoverableInputVat.ToString("N2"), text);
                Assert.Contains(screen.NetVatPayable.ToString("N2"), text);
                foreach (var other in tenants.Where(other => other.Id != tenant.Id))
                    Assert.DoesNotContain($"{other.Slug}-SALE-1", text, StringComparison.Ordinal);
            }

            var calculation = await controller.CalculateVatReturn(new VatReturnCalculateRequest
            {
                From = new DateTime(2025, 1, 1), To = new DateTime(2025, 3, 31)
            });
            Assert.IsType<OkObjectResult>(calculation.Result);
            var period = await context.VatReturnPeriods.SingleAsync(item => item.TenantId == tenant.Id);
            Assert.IsType<OkObjectResult>((await controller.ReviewVatReturnPeriod(period.Id)).Result);
            Assert.IsType<OkObjectResult>((await controller.LockVatReturnPeriod(period.Id)).Result);
            Assert.Equal("Locked", period.Status);
            await Assert.ThrowsAsync<InvalidOperationException>(() => VatReturnWriteGuard.EnsurePeriodOpenAsync(
                context, tenant.Id, new DateTime(2025, 2, 15, 12, 0, 0, DateTimeKind.Utc)));
            var amend = await controller.AmendVatReturnPeriod(period.Id,
                new VatReturnAmendRequest { Reason = "Synthetic end-to-end correction" });
            Assert.IsType<OkObjectResult>(amend.Result);
            Assert.Equal("Calculated", period.Status);
            Assert.Equal(2, period.SnapshotVersion);
            Assert.Contains("Synthetic end-to-end correction", period.SnapshotHistoryJson, StringComparison.Ordinal);
        }
    }

    private static ReportsController CreateTenantController(AppDbContext context, int tenantId) => new(
        null!, new VatReturnReportService(context, NullLogger<VatReturnReportService>.Instance),
        new VatReturnValidationService(context), context, new TimeZoneService(), null!, null!,
        NullLogger<ReportsController>.Instance)
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                [
                    new Claim("tid", tenantId.ToString()),
                    new Claim(ClaimTypes.NameIdentifier, tenantId.ToString()),
                    new Claim(ClaimTypes.Role, "Owner")
                ], "synthetic"))
            }
        }
    };
}
