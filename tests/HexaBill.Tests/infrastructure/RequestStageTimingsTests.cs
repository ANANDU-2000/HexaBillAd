using HexaBill.Api.Core.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;

namespace HexaBill.Tests;

public sealed class RequestStageTimingsTests
{
    [Theory]
    [InlineData("Development", true)]
    [InlineData("Production", false)]
    [InlineData("Staging", false)]
    public async Task LoginTimings_OnlyExposeBrowserHeaderInDevelopment(string environment, bool exposesHeader)
    {
        string? serverTiming = null;
        using var server = new TestServer(new WebHostBuilder().UseEnvironment(environment).Configure(app => app.Run(async context =>
        {
            RequestStageTimings.StartLogin(context);
            using (RequestStageTimings.Measure(context, RequestStage.UserLookup)) { }
            using (RequestStageTimings.Measure(context, RequestStage.PasswordVerification)) { }
            serverTiming = RequestStageTimings.Read(context);
            await context.Response.WriteAsync("ok");
        })));
        using var response = await server.CreateClient().PostAsync("/api/auth/login", new StringContent("private-input-not-a-metric"));
        Assert.Equal(exposesHeader, response.Headers.Contains("Server-Timing"));
        Assert.NotNull(serverTiming);
        Assert.Contains("user_lookup;dur=", serverTiming);
        Assert.Contains("bcrypt;dur=", serverTiming);
        Assert.DoesNotContain("private-input", serverTiming);
        if (exposesHeader)
            Assert.Equal(serverTiming, Assert.Single(response.Headers.GetValues("Server-Timing")));
    }

    [Theory]
    [InlineData("GET", "/api/auth/login")]
    [InlineData("POST", "/api/sales")]
    public void OtherRequests_DoNotCollectLoginTimings(string method, string path)
    {
        var context = new DefaultHttpContext();
        context.Request.Method = method;
        context.Request.Path = path;
        RequestStageTimings.StartLogin(context);
        using (RequestStageTimings.Measure(context, RequestStage.PasswordVerification)) { }
        Assert.Null(RequestStageTimings.Read(context));
    }
}
