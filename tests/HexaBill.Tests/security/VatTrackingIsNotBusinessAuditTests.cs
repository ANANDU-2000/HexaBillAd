using Microsoft.Extensions.Logging.Abstractions;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Reports;

namespace HexaBill.Tests;

// UIX-008: UI view and click telemetry must not be written into the business audit log.
public class VatTrackingIsNotBusinessAuditTests
{
    private sealed class RecordingAudit : IAuditService
    {
        public List<string> Actions { get; } = new();

        public Task LogAsync(string action, string? entityType = null, int? entityId = null, object? oldValues = null,
            object? newValues = null, string? details = null, int? actingUserId = null)
        {
            Actions.Add(action);
            return Task.CompletedTask;
        }
    }

    [Fact(DisplayName = "UIX008_VatTrackingEvent_DoesNotWriteAuditRow")]
    public void VatTrackingEvent_DoesNotWriteAuditRow()
    {
        var audit = new RecordingAudit();
        var controller = new ReportsController(
            null!, null!, null!, null!, null!, null!,
            audit,
            NullLogger<ReportsController>.Instance);

        var result = controller.TrackVatEvent(new VatTrackingRequest { EventType = "TabView", Page = "VatReturn" })
            .GetAwaiter().GetResult();

        Assert.NotNull(result.Result);
        Assert.Empty(audit.Actions);
    }
}
