using BackupHub.Application.Features.Settings;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackupHub.WebApi.Controllers;

[Authorize]
public sealed class SettingsController(ISender mediator, IConfiguration config) : ApiController(mediator)
{
    [HttpGet]
    public async Task<ActionResult<SettingsDto>> Get(CancellationToken ct)
        => Ok(await Mediator.Send(new GetSettingsQuery(), ct));

    [HttpGet("hub-token")]
    public ActionResult<object> HubToken()
        => Ok(new { token = config["Hub:Token"] ?? "" });

    [HttpPut("google")]
    public async Task<ActionResult<bool>> UpdateGoogle(UpdateGoogleSettingsCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command, ct));

    [HttpPut("locale")]
    public async Task<ActionResult<bool>> UpdateLocale(UpdateLocaleCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command, ct));
}
