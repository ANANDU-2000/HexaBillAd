using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Documents;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using UglyToad.PdfPig;

namespace HexaBill.Tests;

/// <summary>
/// P0-PRINT-010 (release blocker): agreements and salary certificates for a tenant with a blank company name must print
/// no company name at all, never the hard-coded ZAYOGA identity or another tenant's name. Two made-up tenants only.
/// </summary>
public class LetterIdentityNoForeignNameTests
{
    private const int BlankTenant = 9101;
    private const int BetaTenant = 9102;

    private static async Task<AppDbContext> SeedAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.SetRequestTenantScope(null, true);
        db.Tenants.Add(new Tenant { Id = BlankTenant, Name = "", Subdomain = "synthetic-blank" });
        db.Tenants.Add(new Tenant { Id = BetaTenant, Name = "Synthetic Beta Foods", Subdomain = "synthetic-beta" });
        db.Settings.Add(new Setting { TenantId = BetaTenant, OwnerId = BetaTenant, Key = "COMPANY_NAME_EN", Value = "SYNTHETIC BETA FOODS LLC" });
        await db.SaveChangesAsync();
        return db;
    }

    private static PdfService Pdf(AppDbContext db)
    {
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        return new PdfService(db, null!, fonts, new SettingsService(db), null!, NullLogger<PdfService>.Instance, null!);
    }

    private static string Text(byte[] pdf)
    {
        using var d = PdfDocument.Open(pdf);
        return string.Join("\n", d.GetPages().Select(p => p.Text));
    }

    [Fact]
    public void AgreementTemplate_BlankFirstParty_NeverUsesZayoga()
    {
        Assert.DoesNotContain("ZAYOGA", AgreementTemplate.Whereas("Second", ""), StringComparison.OrdinalIgnoreCase);
        Assert.All(AgreementTemplate.BuildClauses(" "), c => Assert.DoesNotContain("ZAYOGA", c, StringComparison.OrdinalIgnoreCase));
        Assert.All(AgreementTemplate.BuildClauses(), c => Assert.DoesNotContain("ZAYOGA", c, StringComparison.OrdinalIgnoreCase));
        Assert.Contains("SYNTHETIC BETA FOODS LLC", AgreementTemplate.Whereas("Second", "SYNTHETIC BETA FOODS LLC"));
    }

    [Fact]
    public async Task BlankTenant_AgreementPreviewAndPdf_PrintNoForeignName()
    {
        await using var db = await SeedAsync();
        var svc = new AgreementService(db, NullLogger<AgreementService>.Instance);
        var dto = await svc.GetBlankPreviewAsync(BlankTenant);
        Assert.Equal("", dto.FirstPartyName);
        Assert.DoesNotContain("ZAYOGA", dto.WhereasText ?? "", StringComparison.OrdinalIgnoreCase);
        var text = Text(await Pdf(db).GenerateAgreementPdfAsync(dto, BlankTenant));
        Assert.DoesNotContain("ZAYOGA", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("BETA", text, StringComparison.OrdinalIgnoreCase);
        // stored agreement whose saved text was empty: PDF fallback must not invent a name either
        dto.WhereasText = ""; dto.Clauses = new List<string>();
        text = Text(await Pdf(db).GenerateAgreementPdfAsync(dto, BlankTenant));
        Assert.DoesNotContain("ZAYOGA", text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task BetaTenant_AgreementPdf_PrintsOnlyItsOwnName()
    {
        await using var db = await SeedAsync();
        var dto = await new AgreementService(db, NullLogger<AgreementService>.Instance).GetBlankPreviewAsync(BetaTenant);
        dto.WhereasText = ""; dto.Clauses = new List<string>();
        var text = Text(await Pdf(db).GenerateAgreementPdfAsync(dto, BetaTenant));
        Assert.Contains("SYNTHETIC BETA FOODS LLC", text);
        Assert.DoesNotContain("ZAYOGA", text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task BlankTenant_SalaryCertificatePdf_PrintsNoZayogaNameAddressOrSignatory()
    {
        await using var db = await SeedAsync();
        var cert = new SalaryCertificateDto { CertificateNo = "SYN-1", CertificateDate = new DateTime(2026, 11, 5), EmployeeName = "Synthetic Employee" };
        var text = Text(await Pdf(db).GenerateSalaryCertificatePdfAsync(cert, BlankTenant));
        Assert.DoesNotContain("ZAYOGA", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(SalaryCertificateTemplate.DefaultSignatoryName, text);
        Assert.DoesNotContain("ADCP TOWER", text);
    }
}
