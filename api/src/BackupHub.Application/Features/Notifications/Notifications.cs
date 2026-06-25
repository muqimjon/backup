using BackupHub.Application.Abstractions;
using BackupHub.Domain.Entities;
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
    public const string WebhookUrl = "Webhook.Url";
    public const string TelegramBotToken = "Telegram.BotToken";
}

public sealed record TelegramChatDto(Guid Id, string ChatId, string? Label, string? Lang);
public sealed record EmailRecipientDto(Guid Id, string Email, string? Name, string? Lang);

public sealed record NotificationSettingsDto(
    string NotifyOn,
    string? SmtpHost,
    int? SmtpPort,
    string? SmtpUser,
    string? SmtpFrom,
    bool SmtpPassSet,
    string? WebhookUrl,
    bool TelegramBotSet,
    IReadOnlyList<TelegramChatDto> Chats,
    IReadOnlyList<EmailRecipientDto> Recipients);

public sealed record GetNotificationSettingsQuery : IRequest<NotificationSettingsDto>;

internal sealed class GetNotificationSettingsHandler(ISettingsService settings, IAppDbContext db)
    : IRequestHandler<GetNotificationSettingsQuery, NotificationSettingsDto>
{
    public async ValueTask<NotificationSettingsDto> Handle(GetNotificationSettingsQuery query, CancellationToken ct)
    {
        var c = await settings.GetManyAsync(
            [Keys.NotifyOn, Keys.SmtpHost, Keys.SmtpPort, Keys.SmtpUser, Keys.SmtpPass, Keys.SmtpFrom, Keys.WebhookUrl, Keys.TelegramBotToken], ct);

        var chats = await db.TelegramChats.Where(t => t.Confirmed)
            .Select(t => new TelegramChatDto(t.Id, t.ChatId, t.Label, t.Lang)).ToListAsync(ct);
        var recipients = await db.EmailRecipients
            .OrderBy(r => r.Email)
            .Select(r => new EmailRecipientDto(r.Id, r.Email, r.Name, r.Lang)).ToListAsync(ct);

        return new NotificationSettingsDto(
            c.GetValueOrDefault(Keys.NotifyOn, "failure"),
            c.GetValueOrDefault(Keys.SmtpHost),
            int.TryParse(c.GetValueOrDefault(Keys.SmtpPort), out var p) ? p : null,
            c.GetValueOrDefault(Keys.SmtpUser),
            c.GetValueOrDefault(Keys.SmtpFrom),
            c.ContainsKey(Keys.SmtpPass),
            c.GetValueOrDefault(Keys.WebhookUrl),
            c.ContainsKey(Keys.TelegramBotToken),
            chats, recipients);
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
    string? SmtpHost, int? SmtpPort, string? SmtpUser, string? SmtpPass, string? SmtpFrom) : IRequest<bool>;

internal sealed class UpdateEmailHandler(ISettingsService settings)
    : IRequestHandler<UpdateEmailCommand, bool>
{
    public async ValueTask<bool> Handle(UpdateEmailCommand command, CancellationToken ct)
    {
        await settings.SetAsync(Keys.SmtpHost, command.SmtpHost, ct);
        await settings.SetAsync(Keys.SmtpPort, command.SmtpPort?.ToString(), ct);
        await settings.SetAsync(Keys.SmtpUser, command.SmtpUser, ct);
        await settings.SetAsync(Keys.SmtpFrom, command.SmtpFrom, ct);
        if (!string.IsNullOrWhiteSpace(command.SmtpPass))
            await settings.SetAsync(Keys.SmtpPass, command.SmtpPass, ct);
        return true;
    }
}

public sealed record AddEmailRecipientCommand(string Email, string? Name, string? Lang) : IRequest<Guid>;

internal sealed class AddEmailRecipientHandler(IAppDbContext db)
    : IRequestHandler<AddEmailRecipientCommand, Guid>
{
    public async ValueTask<Guid> Handle(AddEmailRecipientCommand command, CancellationToken ct)
    {
        var email = command.Email.Trim();
        var existing = await db.EmailRecipients.FirstOrDefaultAsync(r => r.Email == email, ct);
        if (existing is not null)
        {
            existing.Name = command.Name;
            existing.Lang = command.Lang;
            await db.SaveChangesAsync(ct);
            return existing.Id;
        }
        var row = new EmailRecipient { Email = email, Name = command.Name, Lang = command.Lang };
        db.EmailRecipients.Add(row);
        await db.SaveChangesAsync(ct);
        return row.Id;
    }
}

public sealed record RemoveEmailRecipientCommand(Guid Id) : IRequest<bool>;

internal sealed class RemoveEmailRecipientHandler(IAppDbContext db)
    : IRequestHandler<RemoveEmailRecipientCommand, bool>
{
    public async ValueTask<bool> Handle(RemoveEmailRecipientCommand command, CancellationToken ct)
    {
        var row = await db.EmailRecipients.FirstOrDefaultAsync(r => r.Id == command.Id, ct);
        if (row is null) return false;
        db.EmailRecipients.Remove(row);
        await db.SaveChangesAsync(ct);
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

internal sealed class UpdateTelegramTokenHandler(ISettingsService settings, INotificationSender sender)
    : IRequestHandler<UpdateTelegramTokenCommand, bool>
{
    public async ValueTask<bool> Handle(UpdateTelegramTokenCommand command, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(command.TelegramBotToken))
            return true;

        var error = await sender.ValidateTelegramTokenAsync(command.TelegramBotToken.Trim(), ct);
        if (error is not null)
            throw new Common.ConflictException(error);

        await settings.SetAsync(Keys.TelegramBotToken, command.TelegramBotToken.Trim(), ct);
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
        if (chat is null) return false;
        chat.Confirmed = true;
        chat.Code = null;
        await db.SaveChangesAsync(ct);
        return true;
    }
}

public sealed record SetTelegramChatLangCommand(Guid Id, string? Lang) : IRequest<bool>;

internal sealed class SetTelegramChatLangHandler(IAppDbContext db)
    : IRequestHandler<SetTelegramChatLangCommand, bool>
{
    public async ValueTask<bool> Handle(SetTelegramChatLangCommand command, CancellationToken ct)
    {
        var chat = await db.TelegramChats.FirstOrDefaultAsync(c => c.Id == command.Id, ct);
        if (chat is null) return false;
        chat.Lang = command.Lang;
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
        if (chat is null) return false;
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
