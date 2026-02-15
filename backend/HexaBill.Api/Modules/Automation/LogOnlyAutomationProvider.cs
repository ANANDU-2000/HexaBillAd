namespace HexaBill.Api.Modules.Automation;

public class LogOnlyAutomationProvider : IAutomationProvider
{
    private readonly ILogger<LogOnlyAutomationProvider> _logger;

    public LogOnlyAutomationProvider(ILogger<LogOnlyAutomationProvider> logger) => _logger = logger;

    public Task NotifyAsync(string eventType, int? tenantId, object? payload, CancellationToken ct = default)
    {
        _logger.LogInformation("Automation event: {EventType} TenantId={TenantId} Payload={Payload}", eventType, tenantId, payload != null ? System.Text.Json.JsonSerializer.Serialize(payload) : null);
        return Task.CompletedTask;
    }
}
