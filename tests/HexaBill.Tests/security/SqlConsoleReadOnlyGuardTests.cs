using System.Reflection;
using HexaBill.Api.Modules.SuperAdmin;

namespace HexaBill.Tests;

// UIX-002: the super admin SQL console is only safe if the server refuses anything but a single SELECT.
// ValidateReadOnly is the first line of that guard (the read-only transaction is the second).
public class SqlConsoleReadOnlyGuardTests
{
    private static (bool valid, string? error) Validate(string query)
    {
        var method = typeof(SqlConsoleController).GetMethod(
            "ValidateReadOnly",
            BindingFlags.NonPublic | BindingFlags.Static)
            ?? throw new InvalidOperationException("ValidateReadOnly not found");
        return ((bool valid, string? error))method.Invoke(null, new object[] { query })!;
    }

    [Theory(DisplayName = "UIX002_SingleSelect_IsAccepted")]
    [InlineData("SELECT 1 AS id, current_database() AS db")]
    [InlineData("select * from \"Sales\" where \"Id\" = 1;")]
    [InlineData("SELECT 1 /* DROP TABLE x */")]
    [InlineData("SELECT 1 -- DELETE FROM x")]
    public void SingleSelect_IsAccepted(string query)
    {
        var (valid, error) = Validate(query);
        Assert.True(valid, error);
    }

    [Theory(DisplayName = "UIX002_WriteOrDdl_IsRejected")]
    [InlineData("DELETE FROM \"Users\" WHERE 1 = 1")]
    [InlineData("UPDATE \"Users\" SET \"Role\" = 'x' WHERE 1 = 1")]
    [InlineData("INSERT INTO \"Users\" (\"Name\") VALUES ('x')")]
    [InlineData("DROP TABLE \"Users\"")]
    [InlineData("WITH d AS (DELETE FROM \"Users\" RETURNING 1) SELECT * FROM d")]
    [InlineData("SELECT * INTO backup_users FROM \"Users\"")]
    [InlineData("SELECT 1; DROP TABLE \"Users\"")]
    [InlineData("SELECT 1; SELECT 2")]
    public void WriteOrDdlOrStackedStatement_IsRejected(string query)
    {
        var (valid, _) = Validate(query);
        Assert.False(valid);
    }

    [Fact(DisplayName = "UIX002_EmptyAfterComments_IsRejected")]
    public void EmptyAfterComments_IsRejected()
    {
        var (valid, _) = Validate("/* only a comment */ -- and a line comment");
        Assert.False(valid);
    }
}
