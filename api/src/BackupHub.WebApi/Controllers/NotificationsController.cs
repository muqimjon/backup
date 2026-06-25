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

    [HttpPut("mode")]
    public async Task<ActionResult<bool>> Mode(UpdateNotifyModeCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command, ct));

    [HttpPut("email")]
    public async Task<ActionResult<bool>> Email(UpdateEmailCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command, ct));

    [HttpPost("email/recipients")]
    public async Task<ActionResult<Guid>> AddRecipient(AddEmailRecipientCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command, ct));

    [HttpDelete("email/recipients/{id:guid}")]
    public async Task<ActionResult<bool>> RemoveRecipient(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new RemoveEmailRecipientCommand(id), ct));

    [HttpPut("webhook")]
    public async Task<ActionResult<bool>> Webhook(UpdateWebhookCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command, ct));

    [HttpPut("telegram/token")]
    public async Task<ActionResult<bool>> TelegramToken(UpdateTelegramTokenCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command, ct));

    [HttpPut("telegram/{id:guid}/lang")]
    public async Task<ActionResult<bool>> ChatLang(Guid id, [FromBody] string? lang, CancellationToken ct)
        => Ok(await Mediator.Send(new SetTelegramChatLangCommand(id, lang), ct));

    [HttpPut("telegram/{id:guid}/name")]
    public async Task<ActionResult<bool>> ChatName(Guid id, [FromBody] string? name, CancellationToken ct)
        => Ok(await Mediator.Send(new SetTelegramChatNameCommand(id, name), ct));

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
