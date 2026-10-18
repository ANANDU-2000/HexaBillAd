using Microsoft.Extensions.Options;

namespace HexaBill.Api.Modules.Assistant.Ai;

public static class AiServiceRegistration
{
    /// <summary>
    /// Registers the AI gateway. With no "Ai" configuration it is disabled and contacts nothing. Provider keys come only from
    /// configuration, for example environment variables Ai__Providers__openai__ApiKey on the server.
    /// </summary>
    public static IServiceCollection AddAiGateway(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<AiOptions>(configuration.GetSection(AiOptions.Section));
        services.AddHttpClient();
        // The budget lives in the database so it survives restarts and is shared by every instance. The in-memory ledger remains
        // for tests and for hosts with no database (Ai:UsageLedger=memory).
        services.AddSingleton<InMemoryAiUsageLedger>();
        services.AddSingleton<PersistentAiUsageLedger>();
        services.AddSingleton<IAiUsageLedger>(sp =>
            string.Equals(configuration["Ai:UsageLedger"], "memory", StringComparison.OrdinalIgnoreCase)
                ? sp.GetRequiredService<InMemoryAiUsageLedger>()
                : sp.GetRequiredService<PersistentAiUsageLedger>());
        services.AddSingleton(sp =>
        {
            var options = sp.GetRequiredService<IOptions<AiOptions>>();
            var factory = sp.GetRequiredService<IHttpClientFactory>();
            var providers = new List<IAiProvider> { new MockAiProvider() };
            foreach (var (key, provider) in options.Value.Providers)
            {
                if (key.Equals("mock", StringComparison.OrdinalIgnoreCase)) continue;
                var http = factory.CreateClient("ai-" + key);
                if (provider.Kind.Equals("gemini", StringComparison.OrdinalIgnoreCase)) providers.Add(new GeminiProvider(key, provider, http));
                else if (provider.Kind.Equals("openai-compatible", StringComparison.OrdinalIgnoreCase)) providers.Add(new OpenAiCompatibleProvider(key, provider, http));
            }
            return new AiGateway(options, providers, sp.GetRequiredService<IAiUsageLedger>(), sp.GetRequiredService<ILogger<AiGateway>>());
        });
        return services;
    }
}
