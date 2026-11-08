using System.Net;
using System.Text;
using HexaBill.Api.Modules.Assistant.Ai;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace HexaBill.Tests.Assistant;

/// <summary>Model pools, provider chain and runtime (super admin) settings. Stub HTTP only; no real provider is contacted.</summary>
public class AiGatewayPoolTests
{
    private sealed class Stub : HttpMessageHandler
    {
        private readonly Func<string, HttpResponseMessage> _byModel;
        public List<string> Models { get; } = new();
        public List<HttpRequestMessage> Requests { get; } = new();
        public Stub(Func<string, HttpResponseMessage> byModel) => _byModel = byModel;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var body = await request.Content!.ReadAsStringAsync(ct);
            var model = System.Text.Json.JsonDocument.Parse(body).RootElement.GetProperty("model").GetString()!;
            Models.Add(model); Requests.Add(request);
            return _byModel(model);
        }
    }

    private sealed class Runtime : IAiRuntimeSettings { public AiRuntime Current { get; set; } = new(); }

    private static HttpResponseMessage Ok(string text = "hi") => new(HttpStatusCode.OK) { Content = new StringContent("{\"choices\":[{\"message\":{\"content\":\"" + text + "\"}}],\"usage\":{\"prompt_tokens\":5,\"completion_tokens\":2}}", Encoding.UTF8, "application/json") };
    private static HttpResponseMessage Status(HttpStatusCode c) => new(c) { Content = new StringContent("{}", Encoding.UTF8, "application/json") };

    private static AiProviderOptions Pool(string model, string pool, bool paid = false, string url = "https://openrouter.ai/api/v1") =>
        new() { Kind = "openai-compatible", BaseUrl = url, Model = model, ModelPool = pool, ApiKey = "TEST-ONLY", Paid = paid };

    private static AiGateway Gateway(AiOptions o, IAiRuntimeSettings? rt, params IAiProvider[] p) =>
        new(Options.Create(o), p, new InMemoryAiUsageLedger(), NullLogger<AiGateway>.Instance, runtime: rt);

    private static AiCall Call() => new(1, 1, "t", "hello", false);

    [Fact]
    public async Task RateLimitedModel_FallsToNextModel_AndReportsWhichAnswered()
    {
        var stub = new Stub(m => m == "a:free" ? Status(HttpStatusCode.TooManyRequests) : Ok("from b"));
        var p = new OpenAiCompatibleProvider("or", Pool("a:free", "b:free,c:free"), new HttpClient(stub));
        var g = Gateway(new AiOptions { Enabled = true, Provider = "or" }, null, p);
        var r = await g.CompleteAsync(Call());
        Assert.True(r.Ok);
        Assert.Equal("b:free", r.Model);
        Assert.Equal(new[] { "a:free", "b:free" }, stub.Models);
    }

    [Fact]
    public async Task RateLimitedModel_RestsAndIsSkippedOnTheNextCall()
    {
        var now = DateTime.UtcNow;
        var stub = new Stub(m => m == "a:free" ? Status(HttpStatusCode.TooManyRequests) : Ok());
        var p = new OpenAiCompatibleProvider("or", Pool("a:free", "b:free"), new HttpClient(stub), null, () => now);
        var g = Gateway(new AiOptions { Enabled = true, Provider = "or" }, null, p);
        await g.CompleteAsync(Call());
        stub.Models.Clear();
        await g.CompleteAsync(Call());
        Assert.Equal(new[] { "b:free" }, stub.Models); // a:free is resting
    }

    [Fact]
    public async Task EmptyAnswerAndErrorBodyWith200_AreTreatedAsFailures()
    {
        var stub = new Stub(m => m switch
        {
            "a" => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"error\":{\"message\":\"upstream\"}}", Encoding.UTF8, "application/json") },
            "b" => Ok(""),
            _ => Ok("real"),
        });
        var p = new OpenAiCompatibleProvider("or", Pool("a", "b,c"), new HttpClient(stub));
        var r = await Gateway(new AiOptions { Enabled = true, Provider = "or" }, null, p).CompleteAsync(Call());
        Assert.True(r.Ok); Assert.Equal("c", r.Model); Assert.Equal("real", r.Text);
    }

    [Fact]
    public async Task AllModelsFail_ReturnsUnavailable_NeverThrows()
    {
        var stub = new Stub(_ => Status(HttpStatusCode.InternalServerError));
        var p = new OpenAiCompatibleProvider("or", Pool("a", "b"), new HttpClient(stub));
        var r = await Gateway(new AiOptions { Enabled = true, Provider = "or" }, null, p).CompleteAsync(Call());
        Assert.Equal(AiOutcome.Unavailable, r.Outcome);
    }

    [Fact]
    public async Task Chain_FreeFirst_ThenPaid_OnlyWhenPaidFallbackAllowed()
    {
        var free = new Stub(_ => Status(HttpStatusCode.TooManyRequests));
        var paid = new Stub(_ => Ok("paid answer"));
        var pf = new OpenAiCompatibleProvider("free", Pool("f", ""), new HttpClient(free));
        var pp = new OpenAiCompatibleProvider("cheap", Pool("p", "", paid: true), new HttpClient(paid));

        var blocked = await Gateway(new AiOptions { Enabled = true, Provider = "free", FallbackProviders = "cheap", AllowPaidFallback = false }, null, pf, pp).CompleteAsync(Call());
        Assert.Equal(AiOutcome.Unavailable, blocked.Outcome);
        Assert.Empty(paid.Models);

        var pf2 = new OpenAiCompatibleProvider("free", Pool("f", ""), new HttpClient(new Stub(_ => Status(HttpStatusCode.TooManyRequests))));
        var allowed = await Gateway(new AiOptions { Enabled = true, Provider = "free", FallbackProviders = "cheap", AllowPaidFallback = true }, null, pf2, pp).CompleteAsync(Call());
        Assert.True(allowed.Ok); Assert.Equal("cheap", allowed.Provider);
    }

    [Fact]
    public async Task Runtime_CanTurnAiOff_ButNeverOnWhenTheEnvironmentIsOff()
    {
        var stub = new Stub(_ => Ok());
        var p = new OpenAiCompatibleProvider("or", Pool("a", ""), new HttpClient(stub));
        var rt = new Runtime { Current = new AiRuntime(Enabled: false) };
        Assert.Equal(AiOutcome.Disabled, (await Gateway(new AiOptions { Enabled = true, Provider = "or" }, rt, p).CompleteAsync(Call())).Outcome);
        rt.Current = new AiRuntime(Enabled: true);
        Assert.Equal(AiOutcome.Disabled, (await Gateway(new AiOptions { Enabled = false, Provider = "or" }, rt, p).CompleteAsync(Call())).Outcome);
        Assert.Empty(stub.Models);
    }

    [Fact]
    public async Task Runtime_ModelChoiceAndLimits_Apply()
    {
        var stub = new Stub(_ => Ok());
        var rt = new Runtime { Current = new AiRuntime(Models: new() { ["or"] = new[] { "chosen:free" } }, DailyCalls: 1) };
        var p = new OpenAiCompatibleProvider("or", Pool("env-model", ""), new HttpClient(stub), rt);
        var g = Gateway(new AiOptions { Enabled = true, Provider = "or", DailyCallLimitPerTenant = 200 }, rt, p);
        Assert.True((await g.CompleteAsync(Call())).Ok);
        Assert.Equal(new[] { "chosen:free" }, stub.Models);
        var second = await g.CompleteAsync(Call());
        Assert.Equal(AiOutcome.Refused, second.Outcome); // the runtime limit of 1 call applies
    }

    [Fact]
    public void OpenRouterRequests_CarryAttributionHeaders_AndNoKeyInTheUrl()
    {
        var stub = new Stub(_ => Ok());
        var p = new OpenAiCompatibleProvider("or", Pool("a", ""), new HttpClient(stub));
        Gateway(new AiOptions { Enabled = true, Provider = "or" }, null, p).CompleteAsync(Call()).GetAwaiter().GetResult();
        var req = stub.Requests.Single();
        Assert.True(req.Headers.Contains("X-Title"));
        Assert.DoesNotContain("TEST-ONLY", req.RequestUri!.ToString());
    }

    [Fact]
    public void Sanitize_DropsBadModelIdsProviderKeysAndClampsLimits()
    {
        var clean = AiRuntimeSettingsStore.Sanitize(new AiRuntime(Provider: "ok_1", Fallbacks: new[] { "bad key!", "good" }, DailyCalls: 99999999, DailyTokens: 5,
            Models: new() { ["or"] = new[] { "meta/llama-3:free", "x; DROP TABLE", "", "meta/llama-3:free" }, ["bad key"] = new[] { "m" } }));
        Assert.Equal("ok_1", clean.Provider);
        Assert.Equal(new[] { "good" }, clean.Fallbacks);
        Assert.Equal(100_000, clean.DailyCalls);
        Assert.Equal(1_000, clean.DailyTokens);
        Assert.Equal(new[] { "meta/llama-3:free" }, clean.Models!["or"]);
        Assert.False(clean.Models.ContainsKey("bad key"));
    }

    [Fact]
    public void Parse_GarbageJson_GivesDefaults()
    {
        Assert.Null(AiRuntimeSettingsStore.Parse("{not json").Provider);
        Assert.Null(AiRuntimeSettingsStore.Parse(null).Enabled);
    }

    [Fact]
    public void ConsentFingerprint_IgnoresRuntimeModelChoice()
    {
        var o = new AiOptions { Enabled = true, Provider = "or", DataPolicyVersion = "v1", DataPolicyNotice = "n" };
        o.Providers["or"] = Pool("a", "b");
        var p = new OpenAiCompatibleProvider("or", o.Providers["or"], new HttpClient(new Stub(_ => Ok())));
        var rt = new Runtime();
        var g = Gateway(o, rt, p);
        var before = g.ConsentPolicy().Fingerprint;
        rt.Current = new AiRuntime(Models: new() { ["or"] = new[] { "other:free" } });
        Assert.NotNull(before);
        Assert.Equal(before, g.ConsentPolicy().Fingerprint);
    }
}
