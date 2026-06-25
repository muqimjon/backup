using BackupHub.Application.Features.Settings;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackupHub.WebApi.Controllers;

[Authorize]
public sealed class SettingsController(ISender mediator) : ApiController(mediator)
{
    [HttpGet]
    public async Task<ActionResult<SettingsDto>> Get(CancellationToken ct)
        => Ok(await Mediator.Send(new GetSettingsQuery(), ct));

    [HttpPut("google")]
    public async Task<ActionResult<bool>> UpdateGoogle(UpdateGoogleSettingsCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command, ct));

    [HttpPut("locale")]
    public async Task<ActionResult<bool>> UpdateLocale(UpdateLocaleCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command, ct));
}
