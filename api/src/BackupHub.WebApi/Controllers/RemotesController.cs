using System.Text;
using System.Text.Json;
using BackupHub.Application.Abstractions;
using BackupHub.Application.Features.Remotes;
using BackupHub.WebApi.Auth;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackupHub.WebApi.Controllers;

public sealed record ConnectState(string Name, string Path);

public sealed class RemotesController(ISender mediator, IGoogleOAuthService google, IConfiguration config) : ApiController(mediator)
{
    [Authorize]
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RemoteDto>>> GetAll(CancellationToken ct)
        => Ok(await Mediator.Send(new GetRemotesQuery(), ct));

    [Authorize]
    [HttpPost("s3")]
    public async Task<ActionResult<Guid>> CreateS3(CreateS3RemoteCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command, ct));

    [Authorize]
    [HttpGet("google/connect")]
    public IActionResult ConnectGoogle([FromQuery] string name, [FromQuery] string path)
    {
        if (string.IsNullOrWhiteSpace(config["Google:ClientId"]))
            return BadRequest(new { error = "Google OAuth is not configured. Set Google:ClientId and Google:ClientSecret in appsettings (see docs)." });

        var state = Base64Url(JsonSerializer.Serialize(new ConnectState(name, path)));
        return Ok(new { url = google.BuildAuthUrl(state, CallbackUri()) });
    }

    [AllowAnonymous]
    [HttpGet("google/callback")]
    public async Task<IActionResult> GoogleCallback([FromQuery] string code, [FromQuery] string state, CancellationToken ct)
    {
        var decoded = JsonSerializer.Deserialize<ConnectState>(
            Encoding.UTF8.GetString(Base64UrlDecode(state)))!;
        var tokenJson = await google.ExchangeCodeAsync(code, CallbackUri(), ct);
        await Mediator.Send(new StoreGoogleRemoteCommand(decoded.Name, decoded.Path, tokenJson), ct);
        return Redirect("/remotes?connected=1");
    }

    [AgentAuth]
    [HttpGet("{id:guid}/rclone-conf")]
    public async Task<IActionResult> RcloneConf(Guid id, CancellationToken ct)
        => Content(await Mediator.Send(new GetRcloneConfigQuery(id), ct), "text/plain");

    private string CallbackUri() => $"{Request.Scheme}://{Request.Host}/api/remotes/google/callback";

    private static string Base64Url(string value)
        => Convert.ToBase64String(Encoding.UTF8.GetBytes(value)).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlDecode(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
        return Convert.FromBase64String(padded);
    }
}
