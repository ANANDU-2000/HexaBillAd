using System.Text.Json;
using HexaBill.Api.Modules.Assistant;

namespace HexaBill.Tests.Assistant;

public class AssistantCallerScopeTests
{
    private sealed class ProbeTool : IAssistantTool
    {
        public int Calls { get; private set; }
        public string Name => "probe";
        public string Description => "Scope probe";
        public IReadOnlyList<string> Arguments => Array.Empty<string>();
        public bool AllowedFor(AssistantCaller caller) => true;
        public Task<AssistantToolResult> RunAsync(AssistantCaller caller, JsonElement args, CancellationToken ct)
        {
            Calls++;
            return Task.FromResult(new AssistantToolResult(Name, Array.Empty<object>(), Array.Empty<AssistantSource>(), DateTime.UtcNow));
        }
    }

    [Theory]
    [InlineData(1, 0)]
    [InlineData(1, -1)]
    [InlineData(0, 1)]
    [InlineData(-1, 1)]
    public async Task MissingTenantOrUserScope_ListsAndRunsNoTools(int tenantId, int userId)
    {
        var probe = new ProbeTool();
        var registry = new AssistantToolRegistry(new[] { probe });
        var caller = new AssistantCaller(tenantId, userId, true);
        Assert.Empty(registry.ToolsFor(caller));
        var refusal = await Assert.ThrowsAsync<AssistantToolException>(() => registry.RunAsync(caller, "probe", default, default));
        Assert.Equal(403, refusal.StatusCode);
        Assert.Equal(0, probe.Calls);
    }

    [Fact]
    public async Task ValidScope_StillListsAndRunsTheAllowedTool()
    {
        var probe = new ProbeTool();
        var registry = new AssistantToolRegistry(new[] { probe });
        var caller = new AssistantCaller(1, 7, true);
        Assert.Single(registry.ToolsFor(caller));
        Assert.Equal("probe", (await registry.RunAsync(caller, "probe", default, default)).Tool);
        Assert.Equal(1, probe.Calls);
    }
}
