using System.Linq;
using System.Reflection;
using HexaBill.Api.Modules.SuperAdmin;
using HexaBill.Api.Modules.Users;
using Microsoft.AspNetCore.Authorization;
using Xunit;

namespace HexaBill.Tests;

public class StaffAuthorizationTests
{
    [Fact]
    public void UserList_DeniesStaff()
    {
        var roles = Roles(typeof(UsersController).GetMethod(nameof(UsersController.GetUsers)));
        Assert.DoesNotContain("Staff", roles);
        Assert.Contains("Admin", roles);
        Assert.Contains("Owner", roles);
    }

    [Fact]
    public void SettingsWrite_DeniesStaff()
    {
        var roles = Roles(typeof(SettingsController).GetMethod(nameof(SettingsController.UpdateSettings)));
        Assert.DoesNotContain("Staff", roles);
        Assert.Contains("Owner", roles);
        Assert.Contains("Admin", roles);
    }

    private static string Roles(MethodInfo? method)
    {
        Assert.NotNull(method);
        var attr = method!.GetCustomAttributes<AuthorizeAttribute>(inherit: true).Single();
        return attr.Roles ?? "";
    }
}
