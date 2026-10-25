using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using UglyToad.PdfPig;

namespace HexaBill.Tests;

/// <summary>
/// P0-PRINT-005: each tenant's own saved COMPANY_PHONE prints in the invoice header on A4/A5/80mm/58mm; when no phone is
/// saved there is no phone line, no "Mob:" label and no dangling separator. Settings are never modified. Synthetic data only.
/// </summary>
public class TenantPhoneHeaderTests
{
    public static TheoryData<string, string, string, bool> Cases()
    {
        var d = new TheoryData<string, string, string, bool>();
        foreach (var tenant in new[] { "frozenhub", "frozenhub2", "gulfharvest" })
            foreach (var style in new[] { "Legacy", "BilingualMonochrome" })
                foreach (var fmt in new[] { "A4", "A5", "80mm", "58mm" })
                    foreach (var phone in new[] { true, false })
                        d.Add(tenant, style, fmt, phone);
        return d;
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public async Task SavedPhonePrints_AndAbsentPhoneLeavesNoLine(string tenant, string style, string format, bool hasPhone)
    {
        var id = tenant switch { "frozenhub" => 89301, "frozenhub2" => 89302, _ => 89303 };
        var phone = $"+97150{id}0";
        await using var db = await SeedAsync(id, tenant, style, hasPhone ? phone : null);
        var bytes = await CreatePdfService(db).GenerateInvoicePdfAsync(CreateSale(id), format, "full");
        var dir = Path.Combine(AppContext.BaseDirectory, "print-p005");
        Directory.CreateDirectory(dir);
        await File.WriteAllBytesAsync(Path.Combine(dir, $"{tenant}_{style}_{format}_{(hasPhone ? "phone" : "nophone")}.pdf"), bytes);

        using var document = PdfDocument.Open(bytes);
        var text = string.Concat(document.GetPages().SelectMany(p => p.Text.Where(c => !char.IsWhiteSpace(c))));
        if (hasPhone)
            Assert.Contains(phone, text);
        else
        {
            Assert.DoesNotContain("Mob", text);
            Assert.DoesNotContain("الهاتف", text);
            Assert.DoesNotContain("+9715", text);
        }
        if (style == "BilingualMonochrome" && tenant.StartsWith("frozenhub"))
            Assert.Contains("AbuDhabi,Musaffah17", text);
        var stored = await db.Settings.Where(s => s.TenantId == id && s.Key == "COMPANY_PHONE").Select(s => s.Value).ToListAsync();
        Assert.Equal(hasPhone ? new List<string> { phone } : new List<string>(), stored);
    }

    private static PdfService CreatePdfService(AppDbContext db)
    {
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        return new PdfService(db, null!, fonts, new SettingsService(db), null!, NullLogger<PdfService>.Instance, null!);
    }

    private static SaleDto CreateSale(int tenantId) => new()
    {
        Id = 9301, OwnerId = tenantId, InvoiceNo = "SYN-P005", InvoiceDate = new DateTime(2026, 11, 5),
        CustomerName = "Synthetic Restaurant", Subtotal = 1234.5m, Discount = 0m, VatTotal = 61.73m, GrandTotal = 1296.23m,
        Items = [new SaleItemDto { ProductId = 1, ProductName = "SYNTHETIC FROZEN product 01", Qty = 10, UnitType = "CTN", UnitPrice = 123.45m, LineTotal = 1296.23m, VatAmount = 61.73m }]
    };

    private static async Task<AppDbContext> SeedAsync(int id, string slug, string style, string? phone)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.SetRequestTenantScope(null, true);
        db.Tenants.Add(new Tenant { Id = id, Name = slug, Subdomain = slug });
        using var img = new Image<Rgba32>(720, 279, new Rgba32(20, 60, 120));
        using var ms = new MemoryStream();
        img.SaveAsPng(ms);
        var s = new Dictionary<string, string>
        {
            ["COMPANY_NAME_EN"] = $"{slug.ToUpperInvariant()} SYNTHETIC FOODSTUFF TRADING - L.L.C",
            ["COMPANY_NAME_AR"] = "شركة اصطناعية لتجارة المواد الغذائية ذ.م.م",
            ["COMPANY_ADDRESS"] = "Synthetic Building 1, Abu Dhabi",
            ["COMPANY_TRN"] = "100000000000003",
            ["INVOICE_HEADER_STYLE"] = style,
            ["CURRENCY"] = "AED",
            ["LOGO_BASE64_DATA_URI"] = "data:image/png;base64," + Convert.ToBase64String(ms.ToArray()),
        };
        if (slug.StartsWith("frozenhub") && style == "BilingualMonochrome") s["INVOICE_HEADER_STYLE_LOCKED"] = "true";
        if (phone != null) s["COMPANY_PHONE"] = phone;
        foreach (var kv in s) db.Settings.Add(new Setting { TenantId = id, OwnerId = id, Key = kv.Key, Value = kv.Value });
        await db.SaveChangesAsync();
        return db;
    }
}
