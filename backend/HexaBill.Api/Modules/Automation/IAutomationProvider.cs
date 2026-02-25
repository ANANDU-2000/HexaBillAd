namespace HexaBill.Api.Modules.Automation;

/// <summary>Goal Step 4: abstraction for WhatsApp/Email later. For now log only.</summary>
public interface IAutomationProvider
{
    Task NotifyAsync(string eventType, int? tenantId, object? payload, CancellationToken ct = default);
}

public static class AutomationEvents
{
    public const string InvoiceCreated = "InvoiceCreated";
    public const string PaymentOverdue = "PaymentOverdue";
    public const string TrialEnding = "TrialEnding";
    public const string TenantSuspended = "TenantSuspended";
    public const string LowStock = "LowStock";
    public const string BackupCompleted = "BackupCompleted";
}
