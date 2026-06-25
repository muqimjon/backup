namespace BackupHub.Infrastructure.Notifications;

internal static class NotificationKeys
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

    public static readonly string[] All =
    [
        NotifyOn, SmtpHost, SmtpPort, SmtpUser, SmtpPass, SmtpFrom, SmtpTo, WebhookUrl, TelegramBotToken,
    ];
}
