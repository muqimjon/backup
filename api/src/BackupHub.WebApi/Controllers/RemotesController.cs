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

public sealed class RemotesController(
    ISender mediator,
    IGoogleOAuthService google,
    IOneDriveOAuthService onedrive,
    IDropboxOAuthService dropbox,
    IYandexOAuthService yandex) : ApiController(mediator)
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
    [HttpPost("b2")]
    public async Task<ActionResult<Guid>> CreateB2(CreateB2RemoteCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command, ct));

    [Authorize]
    [HttpPost("sftp")]
    public async Task<ActionResult<Guid>> CreateSftp(CreateSftpRemoteCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command, ct));

    [Authorize]
    [HttpPost("webdav")]
    public async Task<ActionResult<Guid>> CreateWebDav(CreateWebDavRemoteCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command, ct));

    [Authorize]
    [HttpPost("custom")]
    public async Task<ActionResult<Guid>> CreateCustom(CreateCustomRemoteCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command, ct));

    [Authorize]
    [HttpGet("google/connect")]
    public async Task<IActionResult> ConnectGoogle([FromQuery] string name, [FromQuery] string path, CancellationToken ct)
    {
        if (!await google.IsConfiguredAsync(ct))
            return BadRequest(new { error = "Google OAuth is not configured. Add your Client ID and Secret on the Settings page." });

        var state = Base64Url(JsonSerializer.Serialize(new ConnectState(name, path)));
        return Ok(new { url = await google.BuildAuthUrlAsync(state, CallbackUri(), ct) });
    }

    [AllowAnonymous]
    [HttpGet("google/callback")]
    public async Task<IActionResult> GoogleCallback([FromQuery] string code, [FromQuery] string state, CancellationToken ct)
    {
        var decoded = JsonSerializer.Deserialize<ConnectState>(
            Encoding.UTF8.GetString(Base64UrlDecode(state)))!;
        var tokenJson = await google.ExchangeCodeAsync(code, CallbackUri(), ct);
        await Mediator.Send(new StoreGoogleRemoteCommand(decoded.Name, decoded.Path, tokenJson), ct);
        return Redirect("/destinations?connected=1");
    }

    [Authorize]
    [HttpGet("onedrive/connect")]
    public async Task<IActionResult> ConnectOneDrive([FromQuery] string name, [FromQuery] string path, CancellationToken ct)
    {
        if (!await onedrive.IsConfiguredAsync(ct))
            return BadRequest(new { error = "OneDrive OAuth is not configured. Add your Client ID and Secret on the Destinations page." });

        var state = Base64Url(JsonSerializer.Serialize(new ConnectState(name, path)));
        return Ok(new { url = await onedrive.BuildAuthUrlAsync(state, OneDriveCallbackUri(), ct) });
    }

    [AllowAnonymous]
    [HttpGet("onedrive/callback")]
    public async Task<IActionResult> OneDriveCallback([FromQuery] string code, [FromQuery] string state, CancellationToken ct)
    {
        var decoded = JsonSerializer.Deserialize<ConnectState>(
            Encoding.UTF8.GetString(Base64UrlDecode(state)))!;
        var configJson = await onedrive.ExchangeCodeAsync(code, OneDriveCallbackUri(), ct);
        await Mediator.Send(new StoreOneDriveRemoteCommand(decoded.Name, decoded.Path, configJson), ct);
        return Redirect("/destinations?connected=1");
    }

    private string OneDriveCallbackUri() => $"{Request.Scheme}://{Request.Host}/api/remotes/onedrive/callback";

    [Authorize]
    [HttpGet("dropbox/connect")]
    public async Task<IActionResult> ConnectDropbox([FromQuery] string name, [FromQuery] string path, CancellationToken ct)
    {
        if (!await dropbox.IsConfiguredAsync(ct))
            return BadRequest(new { error = "Dropbox OAuth is not configured. Add your App key and secret on the Destinations page." });
        var state = Base64Url(JsonSerializer.Serialize(new ConnectState(name, path)));
        return Ok(new { url = await dropbox.BuildAuthUrlAsync(state, DropboxCallbackUri(), ct) });
    }

    [AllowAnonymous]
    [HttpGet("dropbox/callback")]
    public async Task<IActionResult> DropboxCallback([FromQuery] string code, [FromQuery] string state, CancellationToken ct)
    {
        var decoded = JsonSerializer.Deserialize<ConnectState>(Encoding.UTF8.GetString(Base64UrlDecode(state)))!;
        var tokenJson = await dropbox.ExchangeCodeAsync(code, DropboxCallbackUri(), ct);
        await Mediator.Send(new StoreDropboxRemoteCommand(decoded.Name, decoded.Path, tokenJson), ct);
        return Redirect("/destinations?connected=1");
    }

    private string DropboxCallbackUri() => $"{Request.Scheme}://{Request.Host}/api/remotes/dropbox/callback";

    [Authorize]
    [HttpGet("yandex/connect")]
    public async Task<IActionResult> ConnectYandex([FromQuery] string name, [FromQuery] string path, CancellationToken ct)
    {
        if (!await yandex.IsConfiguredAsync(ct))
            return BadRequest(new { error = "Yandex OAuth is not configured. Add your Client ID and password on the Destinations page." });
        var state = Base64Url(JsonSerializer.Serialize(new ConnectState(name, path)));
        return Ok(new { url = await yandex.BuildAuthUrlAsync(state, YandexCallbackUri(), ct) });
    }

    [AllowAnonymous]
    [HttpGet("yandex/callback")]
    public async Task<IActionResult> YandexCallback([FromQuery] string code, [FromQuery] string state, CancellationToken ct)
    {
        var decoded = JsonSerializer.Deserialize<ConnectState>(Encoding.UTF8.GetString(Base64UrlDecode(state)))!;
        var tokenJson = await yandex.ExchangeCodeAsync(code, YandexCallbackUri(), ct);
        await Mediator.Send(new StoreYandexRemoteCommand(decoded.Name, decoded.Path, tokenJson), ct);
        return Redirect("/destinations?connected=1");
    }

    private string YandexCallbackUri() => $"{Request.Scheme}://{Request.Host}/api/remotes/yandex/callback";

    [AgentAuth]
    [HttpGet("{id:guid}/rclone-conf")]
    public async Task<IActionResult> RcloneConf(Guid id, CancellationToken ct)
        => Content(await Mediator.Send(new GetRcloneConfigQuery(id), ct), "text/plain");

    [Authorize]
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<bool>> Delete(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new Application.Features.Management.DeleteRemoteCommand(id), ct));

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
