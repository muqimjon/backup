using BackupHub.Application.Abstractions;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Application.Features.Notifications;

internal static class Keys
{
    public const string NotifyOn = "Notify.On";
    public const string SmtpHost = "Smtp.Host";
    public const string SmtpPort = "Smtp.Port";
    public const string SmtpUser = "Smtp.User";
    public const string SmtpPass = "Smtp.Pass";
    public const string SmtpFrom = "Smtp.From";
    public const string SmtpTo = "Smtp.To";
    public const string WebhookUrl = "Webhook.Url";
    public const string TelegramBotToken = "Telegram.BotToken";
}

public sealed record TelegramChatDto(Guid Id, string ChatId, string? Label);

public sealed record NotificationSettingsDto(
    string NotifyOn,
    string? SmtpHost,
    int? SmtpPort,
    string? SmtpUser,
    string? SmtpFrom,
    string? SmtpTo,
    bool SmtpPassSet,
    string? WebhookUrl,
    bool TelegramBotSet,
    IReadOnlyList<TelegramChatDto> Chats);

public sealed record GetNotificationSettingsQuery : IRequest<NotificationSettingsDto>;

internal sealed class GetNotificationSettingsHandler(ISettingsService settings, IAppDbContext db)
    : IRequestHandler<GetNotificationSettingsQuery, NotificationSettingsDto>
{
    public async ValueTask<NotificationSettingsDto> Handle(GetNotificationSettingsQuery query, CancellationToken ct)
    {
        var c = await settings.GetManyAsync(
            [Keys.NotifyOn, Keys.SmtpHost, Keys.SmtpPort, Keys.SmtpUser, Keys.SmtpPass, Keys.SmtpFrom, Keys.SmtpTo, Keys.WebhookUrl, Keys.TelegramBotToken], ct);

        var chats = await db.TelegramChats
            .Where(t => t.Confirmed)
            .Select(t => new TelegramChatDto(t.Id, t.ChatId, t.Label))
            .ToListAsync(ct);

        return new NotificationSettingsDto(
            c.GetValueOrDefault(Keys.NotifyOn, "failure"),
            c.GetValueOrDefault(Keys.SmtpHost),
            int.TryParse(c.GetValueOrDefault(Keys.SmtpPort), out var p) ? p : null,
            c.GetValueOrDefault(Keys.SmtpUser),
            c.GetValueOrDefault(Keys.SmtpFrom),
            c.GetValueOrDefault(Keys.SmtpTo),
            c.ContainsKey(Keys.SmtpPass),
            c.GetValueOrDefault(Keys.WebhookUrl),
            c.ContainsKey(Keys.TelegramBotToken),
            chats);
    }
}

public sealed record UpdateNotifyModeCommand(string NotifyOn) : IRequest<bool>;

internal sealed class UpdateNotifyModeHandler(ISettingsService settings)
    : IRequestHandler<UpdateNotifyModeCommand, bool>
{
    public async ValueTask<bool> Handle(UpdateNotifyModeCommand command, CancellationToken ct)
    {
        await settings.SetAsync(Keys.NotifyOn, string.IsNullOrWhiteSpace(command.NotifyOn) ? "failure" : command.NotifyOn, ct);
        return true;
    }
}

public sealed record UpdateEmailCommand(
    string? SmtpHost, int? SmtpPort, string? SmtpUser, string? SmtpPass, string? SmtpFrom, string? SmtpTo) : IRequest<bool>;

internal sealed class UpdateEmailHandler(ISettingsService settings)
    : IRequestHandler<UpdateEmailCommand, bool>
{
    public async ValueTask<bool> Handle(UpdateEmailCommand command, CancellationToken ct)
    {
        await settings.SetAsync(Keys.SmtpHost, command.SmtpHost, ct);
        await settings.SetAsync(Keys.SmtpPort, command.SmtpPort?.ToString(), ct);
        await settings.SetAsync(Keys.SmtpUser, command.SmtpUser, ct);
        await settings.SetAsync(Keys.SmtpFrom, command.SmtpFrom, ct);
        await settings.SetAsync(Keys.SmtpTo, command.SmtpTo, ct);
        if (!string.IsNullOrWhiteSpace(command.SmtpPass))
            await settings.SetAsync(Keys.SmtpPass, command.SmtpPass, ct);
        return true;
    }
}

public sealed record UpdateWebhookCommand(string? WebhookUrl) : IRequest<bool>;

internal sealed class UpdateWebhookHandler(ISettingsService settings)
    : IRequestHandler<UpdateWebhookCommand, bool>
{
    public async ValueTask<bool> Handle(UpdateWebhookCommand command, CancellationToken ct)
    {
        await settings.SetAsync(Keys.WebhookUrl, command.WebhookUrl, ct);
        return true;
    }
}

public sealed record UpdateTelegramTokenCommand(string? TelegramBotToken) : IRequest<bool>;

internal sealed class UpdateTelegramTokenHandler(ISettingsService settings)
    : IRequestHandler<UpdateTelegramTokenCommand, bool>
{
    public async ValueTask<bool> Handle(UpdateTelegramTokenCommand command, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(command.TelegramBotToken))
            await settings.SetAsync(Keys.TelegramBotToken, command.TelegramBotToken, ct);
        return true;
    }
}

public sealed record LinkTelegramCommand(string Code) : IRequest<bool>;

internal sealed class LinkTelegramHandler(IAppDbContext db)
    : IRequestHandler<LinkTelegramCommand, bool>
{
    public async ValueTask<bool> Handle(LinkTelegramCommand command, CancellationToken ct)
    {
        var code = command.Code.Trim();
        var chat = await db.TelegramChats.FirstOrDefaultAsync(c => c.Code == code && !c.Confirmed, ct);
        if (chat is null)
            return false;

        chat.Confirmed = true;
        chat.Code = null;
        await db.SaveChangesAsync(ct);
        return true;
    }
}

public sealed record UnlinkTelegramCommand(Guid Id) : IRequest<bool>;

internal sealed class UnlinkTelegramHandler(IAppDbContext db)
    : IRequestHandler<UnlinkTelegramCommand, bool>
{
    public async ValueTask<bool> Handle(UnlinkTelegramCommand command, CancellationToken ct)
    {
        var chat = await db.TelegramChats.FirstOrDefaultAsync(c => c.Id == command.Id, ct);
        if (chat is null)
            return false;

        db.TelegramChats.Remove(chat);
        await db.SaveChangesAsync(ct);
        return true;
    }
}

public sealed record SendTestNotificationCommand : IRequest<string>;

internal sealed class SendTestNotificationHandler(INotificationSender sender)
    : IRequestHandler<SendTestNotificationCommand, string>
{
    public async ValueTask<string> Handle(SendTestNotificationCommand command, CancellationToken ct)
        => await sender.SendTestAsync(ct);
}
