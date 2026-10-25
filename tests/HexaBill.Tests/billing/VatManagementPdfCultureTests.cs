using System.Globalization;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using UglyToad.PdfPig;

namespace HexaBill.Tests;

/// <summary>P0-PRINT-012: VAT management PDF text is culture-independent and extractable (no ligature glyphs).</summary>
[Collection("HttpIntegration")]
public sealed class VatManagementPdfCultureTests
{
    [Theory]
    [InlineData("en-GB")] [InlineData("en-US")] [InlineData("")]
    public async Task PeriodLine_IsSameUnderAnyHostCulture(string culture)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase($"vat-culture-{Guid.NewGuid():N}").Options;
        await using var context = new AppDbContext(options);
        context.SetRequestTenantScope(null, isPlatformScope: true);
        context.Tenants.Add(new Tenant { Id = 88791, Name = "Synthetic Culture", CompanyNameEn = "Synthetic Culture", Subdomain = "vatculture88791", Country = "AE", Currency = "AED" });
        await context.SaveChangesAsync();
        context.SetRequestTenantScope(88791, isPlatformScope: false);
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        var pdf = new PdfService(context, null!, fonts, new SettingsService(context), null!, NullLogger<PdfService>.Instance, null!);
        var saved = CultureInfo.CurrentCulture;
        byte[] bytes;
        try
        {
            CultureInfo.CurrentCulture = culture == "" ? CultureInfo.InvariantCulture : new CultureInfo(culture);
            bytes = await pdf.GenerateVatManagementReportPdfAsync(new VatReturn201Dto
            {
                CompanyName = "Synthetic Culture", PeriodLabel = "Q3-2026", PeriodStart = new DateTime(2026, 9, 1), PeriodEnd = new DateTime(2026, 9, 30),
                Status = "Draft", TrnStatus = "TRN not verified", VatTrn = "100000000000099"
            }, 88791);
        }
        finally { CultureInfo.CurrentCulture = saved; }
        using var doc = PdfDocument.Open(new MemoryStream(bytes));
        var text = string.Join("\n", doc.GetPages().Select(p => p.Text));
        Assert.Contains("Period: 01-Sep-2026 to 30-Sep-2026", text);
        Assert.DoesNotContain("Sept", text);
        Assert.Contains("TRN not verified", text);
        Assert.Equal(-1, text.IndexOf('\0')); // no unmapped ligature glyphs
    }
}
