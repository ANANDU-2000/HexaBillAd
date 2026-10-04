using HexaBill.Api.Core.Infrastructure;

namespace HexaBill.Tests;

public class DeployVersionResolverTests
{
    [Fact]
    public void Resolve_PrefersRenderGitCommit()
    {
        const string key = "RENDER_GIT_COMMIT";
        var prior = Environment.GetEnvironmentVariable(key);
        Environment.SetEnvironmentVariable(key, "sha-render-abc");
        try
        {
            Assert.Equal("sha-render-abc", DeployVersionResolver.Resolve());
        }
        finally
        {
            Environment.SetEnvironmentVariable(key, prior);
        }
    }

    [Fact]
    public void Resolve_TrimsWhitespace()
    {
        const string key = "GIT_COMMIT";
        var prior = Environment.GetEnvironmentVariable(key);
        Environment.SetEnvironmentVariable("RENDER_GIT_COMMIT", null);
        Environment.SetEnvironmentVariable(key, "  commit-trim  ");
        try
        {
            Assert.Equal("commit-trim", DeployVersionResolver.Resolve());
        }
        finally
        {
            Environment.SetEnvironmentVariable(key, prior);
        }
    }
}
