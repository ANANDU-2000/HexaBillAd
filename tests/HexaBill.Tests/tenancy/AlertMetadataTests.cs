using System.Text.Json;
using HexaBill.Api.Modules.Notifications;

namespace HexaBill.Tests;

/// <summary>
/// Live production rejected every overdue-invoice, backup and stock alert with "value too long for type character varying(500)":
/// the metadata listed too many invoices. SQLite does not enforce lengths, so this guards the limit in code.
/// </summary>
public class AlertMetadataTests
{
    [Fact]
    public void ShortMetadata_IsKeptAsIs()
    {
        var json = AlertService.ToMetadataJson(new { count = 3, tenant = 1 });
        Assert.Equal("{\"count\":3,\"tenant\":1}", json);
        Assert.Null(AlertService.ToMetadataJson(null));
    }

    [Fact]
    public void LongMetadata_BecomesAShortValidSummary_ThatFitsTheColumn()
    {
        var invoices = Enumerable.Range(1, 129).Select(i => $"INV-{i:00000}").ToArray();
        var json = AlertService.ToMetadataJson(new Dictionary<string, object> { ["invoices"] = invoices, ["count"] = invoices.Length })!;
        Assert.True(json.Length <= AlertService.MetadataMax, $"{json.Length} characters");
        using var doc = JsonDocument.Parse(json); // still valid JSON, so readers do not break
        Assert.True(doc.RootElement.GetProperty("truncated").GetBoolean());
        Assert.True(doc.RootElement.GetProperty("originalLength").GetInt32() > AlertService.MetadataMax);
    }

    [Fact]
    public void TheLimitsMatchTheDatabaseColumns()
    {
        Assert.Equal(200, AlertService.TitleMax);
        Assert.Equal(2000, AlertService.MessageMax);
        Assert.Equal(500, AlertService.MetadataMax);
    }
}
