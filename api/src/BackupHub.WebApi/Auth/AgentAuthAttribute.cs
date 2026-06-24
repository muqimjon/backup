using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace BackupHub.WebApi.Auth;

public sealed class AgentAuthAttribute : Attribute, IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var config = context.HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var expected = config["Hub:Token"];
        var provided = context.HttpContext.Request.Headers["X-Hub-Token"].ToString();

        if (string.IsNullOrEmpty(expected) || !CryptographicEquals(provided, expected))
            context.Result = new UnauthorizedResult();
    }

    private static bool CryptographicEquals(string a, string b)
    {
        if (a.Length != b.Length)
            return false;

        var result = 0;
        for (var i = 0; i < a.Length; i++)
            result |= a[i] ^ b[i];
        return result == 0;
    }
}
