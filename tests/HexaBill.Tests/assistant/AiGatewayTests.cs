using System.Net;
using System.Text;
using System.Text.Json;
using HexaBill.Api.Modules.Assistant.Ai;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HexaBill.Tests.Assistant;

/// <summary>The AI gateway enforces its rules without ever contacting a real provider (stub HTTP only).</summary>
public class AiGatewayTests
{
    private const string FakeKey = "TEST-ONLY-NOT-A-REAL-KEY-12345";

    private sealed class StubHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, Task<HttpResponseMessage>> _respond;
        public List<(HttpRequestMessage Request, string Body)> Calls { get; } = new();
        public StubHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> respond) => _respond = respond;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Calls.Add((request, request.Content == null ? string.Empty : await request.Content.ReadAsStringAsync(ct)));
            return await _respond(request);
        }
    }

    private sealed class CapturingLogger<T> : ILogger<T>
    {
        public List<string> Lines { get; } = new();
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
            Lines.Add(formatter(state, exception) + (exception?.ToString() ?? string.Empty));
    }

    private static HttpResponseMessage Json(string json, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    private const string OpenAiOk = "{\"choices\":[{\"message\":{\"content\":\"hello from stub\"}}],\"usage\":{\"prompt_tokens\":11,\"completion_tokens\":5}}";
    private const string GeminiOk = "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"gemini stub\"}]}}],\"usageMetadata\":{\"promptTokenCount\":7,\"candidatesTokenCount\":3}}";

    private static AiProviderOptions OpenAi(bool paid = false) => new()
    {
        Kind = "openai-compatible", BaseUrl = "https://provider.test/v1", Model = "model-from-config", ApiKey = FakeKey, Paid = paid,
    };

    private static (AiGateway gateway, InMemoryAiUsageLedger ledger, CapturingLogger<AiGateway> log) Build(AiOptions options, params IAiProvider[] providers)
    {
        var ledger = new InMemoryAiUsageLedger();
        var log = new CapturingLogger<AiGateway>();
        return (new AiGateway(Options.Create(options), providers, ledger, log), ledger, log);
    }

    private static AiCall Call(string prompt = "Summarise this.", bool customerData = false, int tenant = 1) =>
        new(tenant, 1, "test", prompt, customerData, "You are a helper.");

    [Fact]
    public async Task DisabledByDefault_ContactsNothing()
    {
        var handler = new StubHandler(_ => Task.FromResult(Json(OpenAiOk)));
        var (gateway, _, _) = Build(new AiOptions { Provider = "p" }, new OpenAiCompatibleProvider("p", OpenAi(), new HttpClient(handler)));
        var result = await gateway.CompleteAsync(Call());
        Assert.Equal(AiOutcome.Disabled, result.Outcome);
        Assert.Empty(handler.Calls);
    }

    [Fact]
    public async Task ProviderWithoutAKeyOrModel_IsUnavailable_AndNeverCalled()
    {
        var handler = new StubHandler(_ => Task.FromResult(Json(OpenAiOk)));
        var noKey = OpenAi(); noKey.ApiKey = "";
        var (gateway, _, _) = Build(new AiOptions { Enabled = true, Provider = "p" }, new OpenAiCompatibleProvider("p", noKey, new HttpClient(handler)));
        Assert.Equal(AiOutcome.Unavailable, (await gateway.CompleteAsync(Call())).Outcome);
        var noModel = OpenAi(); noModel.Model = "";
        (gateway, _, _) = Build(new AiOptions { Enabled = true, Provider = "p" }, new OpenAiCompatibleProvider("p", noModel, new HttpClient(handler)));
        Assert.Equal(AiOutcome.Unavailable, (await gateway.CompleteAsync(Call())).Outcome);
        Assert.Empty(handler.Calls);
    }

    [Fact]
    public async Task CustomerData_IsRefusedUntilTheOwnerApproves()
    {
        var handler = new StubHandler(_ => Task.FromResult(Json(OpenAiOk)));
        var provider = new OpenAiCompatibleProvider("p", OpenAi(), new HttpClient(handler));
        var (gateway, _, _) = Build(new AiOptions { Enabled = true, Provider = "p" }, provider);
        var refused = await gateway.CompleteAsync(Call(customerData: true));
        Assert.Equal(AiOutcome.Refused, refused.Outcome);
        Assert.Empty(handler.Calls);

        (gateway, _, _) = Build(new AiOptions { Enabled = true, Provider = "p", AllowCustomerData = true }, provider);
        Assert.True((await gateway.CompleteAsync(Call(customerData: true))).Ok);
        Assert.Single(handler.Calls);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task EmptyPrompt_IsRefused(string prompt)
    {
        var (gateway, _, _) = Build(new AiOptions { Enabled = true, Provider = "mock" }, new MockAiProvider());
        Assert.Equal(AiOutcome.Refused, (await gateway.CompleteAsync(Call(prompt))).Outcome);
    }

    [Fact]
    public async Task OversizedPrompt_AndMissingTenant_AreRefused()
    {
        var (gateway, _, _) = Build(new AiOptions { Enabled = true, Provider = "mock", MaxPromptChars = 50 }, new MockAiProvider());
        Assert.Equal(AiOutcome.Refused, (await gateway.CompleteAsync(Call(new string('x', 51)))).Outcome);
        Assert.Equal(AiOutcome.Refused, (await gateway.CompleteAsync(Call(tenant: 0))).Outcome);
        Assert.True((await gateway.CompleteAsync(Call(new string('x', 50)))).Ok);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task MissingUserScope_ContactsNoProviderAndReservesNoBudget(int userId)
    {
        var handler = new StubHandler(_ => Task.FromResult(Json(OpenAiOk)));
        var (gateway, ledger, _) = Build(new AiOptions { Enabled = true, Provider = "p" }, new OpenAiCompatibleProvider("p", OpenAi(), new HttpClient(handler)));
        var result = await gateway.CompleteAsync(new AiCall(1, userId, "test", "Hello", false));
        Assert.Equal(AiOutcome.Refused, result.Outcome);
        Assert.Empty(handler.Calls);
        Assert.Equal(0, ledger.Snapshot(1, DateTime.UtcNow).Calls);
    }

    [Fact]
    public async Task OpenAiCompatible_SendsTheRightRequest_ParsesTheAnswer_AndNeverLogsKeyOrPrompt()
    {
        var handler = new StubHandler(_ => Task.FromResult(Json(OpenAiOk)));
        var (gateway, _, log) = Build(new AiOptions { Enabled = true, Provider = "p" }, new OpenAiCompatibleProvider("p", OpenAi(), new HttpClient(handler)));
        var secretPrompt = "SENSITIVE-PROMPT-TEXT-98765";
        var result = await gateway.CompleteAsync(Call(secretPrompt));

        Assert.True(result.Ok);
        Assert.Equal("hello from stub", result.Text);
        Assert.Equal(11, result.InputTokens);
        Assert.Equal(5, result.OutputTokens);
        Assert.False(result.TokensEstimated);
        var (request, body) = Assert.Single(handler.Calls);
        Assert.Equal("https://provider.test/v1/chat/completions", request.RequestUri!.ToString());
        Assert.Equal("Bearer " + FakeKey, request.Headers.Authorization!.ToString());
        using var json = JsonDocument.Parse(body);
        Assert.Equal("model-from-config", json.RootElement.GetProperty("model").GetString());
        Assert.Equal("system", json.RootElement.GetProperty("messages")[0].GetProperty("role").GetString());
        Assert.Equal(secretPrompt, json.RootElement.GetProperty("messages")[1].GetProperty("content").GetString());

        var logged = string.Join("\n", log.Lines);
        Assert.NotEmpty(log.Lines);
        Assert.DoesNotContain(FakeKey, logged);
        Assert.DoesNotContain(secretPrompt, logged);
        Assert.DoesNotContain("hello from stub", logged);
    }

    [Fact]
    public async Task Gemini_PutsTheKeyInAHeaderNotTheUrl_AndParsesTheAnswer()
    {
        var handler = new StubHandler(_ => Task.FromResult(Json(GeminiOk)));
        var options = new AiProviderOptions { Kind = "gemini", BaseUrl = "https://gemini.test/v1beta", Model = "gemini-model-from-config", ApiKey = FakeKey };
        var (gateway, _, _) = Build(new AiOptions { Enabled = true, Provider = "g" }, new GeminiProvider("g", options, new HttpClient(handler)));
        var result = await gateway.CompleteAsync(Call());
        Assert.True(result.Ok);
        Assert.Equal("gemini stub", result.Text);
        Assert.Equal(7, result.InputTokens);
        var (request, body) = Assert.Single(handler.Calls);
        Assert.Equal("https://gemini.test/v1beta/models/gemini-model-from-config:generateContent", request.RequestUri!.ToString());
        Assert.DoesNotContain(FakeKey, request.RequestUri!.ToString());
        Assert.Equal(FakeKey, request.Headers.GetValues("x-goog-api-key").Single());
        Assert.Contains("systemInstruction", body);
    }

    [Fact]
    public async Task DailyLimits_ArePerCompany()
    {
        var (gateway, _, _) = Build(new AiOptions { Enabled = true, Provider = "mock", DailyCallLimitPerTenant = 2 }, new MockAiProvider());
        Assert.True((await gateway.CompleteAsync(Call(tenant: 1))).Ok);
        Assert.True((await gateway.CompleteAsync(Call(tenant: 1))).Ok);
        var over = await gateway.CompleteAsync(Call(tenant: 1));
        Assert.Equal(AiOutcome.Refused, over.Outcome);
        Assert.Contains("daily", over.Reason!, StringComparison.OrdinalIgnoreCase);
        Assert.True((await gateway.CompleteAsync(Call(tenant: 2))).Ok); // another company is unaffected
    }

    [Fact]
    public async Task TokenLimit_CountsActualUsage_AndRefusesAnOversizedRequest()
    {
        // Actual usage reported by the provider is 290 tokens, so a second call (estimate about 266) would pass 300.
        var handler = new StubHandler(_ => Task.FromResult(Json("{\"choices\":[{\"message\":{\"content\":\"x\"}}],\"usage\":{\"prompt_tokens\":200,\"completion_tokens\":90}}")));
        var (gateway, ledger, _) = Build(new AiOptions { Enabled = true, Provider = "p", DailyTokenLimitPerTenant = 300 }, new OpenAiCompatibleProvider("p", OpenAi(), new HttpClient(handler)));
        Assert.True((await gateway.CompleteAsync(Call(new string('a', 40)))).Ok);
        Assert.Equal(290, ledger.Snapshot(1, DateTime.UtcNow).Tokens);
        Assert.Equal(AiOutcome.Refused, (await gateway.CompleteAsync(Call(new string('a', 40)))).Outcome);
        Assert.Single(handler.Calls); // the refused call never reached the provider

        // A single request whose own estimate exceeds the limit is refused outright.
        var (small, _, _) = Build(new AiOptions { Enabled = true, Provider = "mock", DailyTokenLimitPerTenant = 300 }, new MockAiProvider());
        Assert.Equal(AiOutcome.Refused, (await small.CompleteAsync(Call(new string('a', 400)))).Outcome);
    }

    [Fact]
    public async Task ProviderFailure_IsUnavailable_NotAnException_AndErrorTextHasNoKey()
    {
        var handler = new StubHandler(_ => Task.FromResult(Json("{\"error\":\"boom\"}", HttpStatusCode.InternalServerError)));
        var (gateway, _, log) = Build(new AiOptions { Enabled = true, Provider = "p" }, new OpenAiCompatibleProvider("p", OpenAi(), new HttpClient(handler)));
        var result = await gateway.CompleteAsync(Call());
        Assert.Equal(AiOutcome.Unavailable, result.Outcome);
        Assert.Contains("normal screens", result.Reason!);
        Assert.DoesNotContain(FakeKey, result.Reason + string.Join("\n", log.Lines));
    }

    [Fact]
    public async Task Timeout_IsUnavailable()
    {
        var handler = new StubHandler(async r => { await Task.Delay(TimeSpan.FromSeconds(10), CancellationToken.None); return Json(OpenAiOk); });
        var (gateway, _, _) = Build(new AiOptions { Enabled = true, Provider = "p", TimeoutSeconds = 1 }, new OpenAiCompatibleProvider("p", OpenAi(), new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(30) }));
        var started = DateTime.UtcNow;
        var result = await gateway.CompleteAsync(Call());
        Assert.Equal(AiOutcome.Unavailable, result.Outcome);
        Assert.True((DateTime.UtcNow - started).TotalSeconds < 8, "the call must be cut off by the gateway timeout");
    }

    [Fact]
    public async Task FreeFallback_IsUsedWhenThePrimaryFails()
    {
        var primary = new StubHandler(_ => Task.FromResult(Json("{}", HttpStatusCode.BadGateway)));
        var backup = new StubHandler(_ => Task.FromResult(Json(OpenAiOk)));
        var (gateway, _, _) = Build(new AiOptions { Enabled = true, Provider = "a", FallbackProvider = "b" },
            new OpenAiCompatibleProvider("a", OpenAi(), new HttpClient(primary)), new OpenAiCompatibleProvider("b", OpenAi(paid: false), new HttpClient(backup)));
        var result = await gateway.CompleteAsync(Call());
        Assert.True(result.Ok);
        Assert.Equal("b", result.Provider);
        Assert.Single(primary.Calls);
        Assert.Single(backup.Calls);
    }

    [Fact]
    public async Task PaidFallback_IsNeverUsedSilently()
    {
        var primary = new StubHandler(_ => Task.FromResult(Json("{}", HttpStatusCode.BadGateway)));
        var paid = new StubHandler(_ => Task.FromResult(Json(OpenAiOk)));
        var providers = new IAiProvider[]
        {
            new OpenAiCompatibleProvider("a", OpenAi(), new HttpClient(primary)),
            new OpenAiCompatibleProvider("b", OpenAi(paid: true), new HttpClient(paid)),
        };
        var (gateway, _, _) = Build(new AiOptions { Enabled = true, Provider = "a", FallbackProvider = "b" }, providers);
        Assert.Equal(AiOutcome.Unavailable, (await gateway.CompleteAsync(Call())).Outcome);
        Assert.Empty(paid.Calls); // the paid provider was not contacted

        // Only an explicit owner setting allows it.
        (gateway, _, _) = Build(new AiOptions { Enabled = true, Provider = "a", FallbackProvider = "b", AllowPaidFallback = true }, providers);
        Assert.True((await gateway.CompleteAsync(Call())).Ok);
        Assert.Single(paid.Calls);
    }

    [Fact]
    public void ProviderOptions_AreNotConfiguredWithoutKeyModelUrlAndAKnownKind()
    {
        Assert.True(OpenAi().IsConfigured);
        Assert.False(new AiProviderOptions { Kind = "unknown", BaseUrl = "u", Model = "m", ApiKey = "k" }.IsConfigured);
        Assert.False(new AiProviderOptions { Kind = "gemini", BaseUrl = "", Model = "m", ApiKey = "k" }.IsConfigured);
    }

    [Fact]
    public async Task Mock_RunsEndToEnd_WithNoNetwork()
    {
        var (gateway, ledger, _) = Build(new AiOptions { Enabled = true, Provider = "mock" }, new MockAiProvider());
        var result = await gateway.CompleteAsync(Call("Hello there"));
        Assert.True(result.Ok);
        Assert.StartsWith("[mock]", result.Text);
        Assert.Equal(1, ledger.Snapshot(1, DateTime.UtcNow).Calls);
    }
}
