using BackupHub.Application.Features.Notifications;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackupHub.WebApi.Controllers;

public sealed record LinkRequest(string Code);

[Authorize]
public sealed class NotificationsController(ISender mediator) : ApiController(mediator)
{
    [HttpGet]
    public async Task<ActionResult<NotificationSettingsDto>> Get(CancellationToken ct)
        => Ok(await Mediator.Send(new GetNotificationSettingsQuery(), ct));

    [HttpPut]
    public async Task<ActionResult<bool>> Update(UpdateNotificationSettingsCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command, ct));

    [HttpPost("telegram/link")]
    public async Task<ActionResult<bool>> Link(LinkRequest body, CancellationToken ct)
        => Ok(await Mediator.Send(new LinkTelegramCommand(body.Code), ct));

    [HttpDelete("telegram/{id:guid}")]
    public async Task<ActionResult<bool>> Unlink(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new UnlinkTelegramCommand(id), ct));

    [HttpPost("test")]
    public async Task<ActionResult<string>> Test(CancellationToken ct)
        => Ok(await Mediator.Send(new SendTestNotificationCommand(), ct));
}
