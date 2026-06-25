using System.Net;
using System.Net.Mail;
using System.Text;
using System.Text.Json;
using BackupHub.Application.Abstractions;
using BackupHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Infrastructure.Notifications;

public sealed class NotificationSender(HttpClient http, ISettingsService settings, AppDbContext db)
    : INotificationSender
{
    public async Task DispatchAsync(string level, string title, string message, CancellationToken ct = default)
    {
        var cfg = await settings.GetManyAsync(NotificationKeys.All, ct);
        var mode = cfg.GetValueOrDefault(NotificationKeys.NotifyOn, "failure");

        if (mode == "never") return;
        if (mode == "failure" && level != "error") return;

        await SendAll(cfg, level, title, message, ct);
    }

    public async Task<string> SendTestAsync(CancellationToken ct = default)
    {
        var cfg = await settings.GetManyAsync(NotificationKeys.All, ct);
        var sent = await SendAll(cfg, "info", "BackupHub test", "✅ Test notification from BackupHub.", ct);
        return sent.Count == 0 ? "No channels configured." : "Sent via: " + string.Join(", ", sent);
    }

    private async Task<List<string>> SendAll(IReadOnlyDictionary<string, string> cfg, string level, string title, string message, CancellationToken ct)
    {
        var icon = level switch { "error" => "🔴", "success" => "✅", _ => "ℹ️" };
        var text = $"{icon} {title}\n{message}";
        var sent = new List<string>();

        if (cfg.TryGetValue(NotificationKeys.TelegramBotToken, out var token) && !string.IsNullOrWhiteSpace(token))
            if (await SendTelegram(token, text, ct)) sent.Add("Telegram");

        if (cfg.TryGetValue(NotificationKeys.SmtpHost, out var host) && !string.IsNullOrWhiteSpace(host))
            if (await SendEmail(cfg, title, text, ct)) sent.Add("Email");

        if (cfg.TryGetValue(NotificationKeys.WebhookUrl, out var url) && !string.IsNullOrWhiteSpace(url))
            if (await SendWebhook(url, level, title, message, ct)) sent.Add("Webhook");

        return sent;
    }

    private async Task<bool> SendTelegram(string token, string text, CancellationToken ct)
    {
        try
        {
            var chats = await db.TelegramChats.Where(c => c.Confirmed).Select(c => c.ChatId).ToListAsync(ct);
            if (chats.Count == 0) return false;
            var ok = false;
            foreach (var chatId in chats)
            {
                var url = $"https://api.telegram.org/bot{token}/sendMessage";
                var payload = JsonContent($"{{\"chat_id\":\"{chatId}\",\"text\":{JsonSerializer.Serialize(text)},\"disable_web_page_preview\":true}}");
                using var res = await http.PostAsync(url, payload, ct);
                ok |= res.IsSuccessStatusCode;
            }
            return ok;
        }
        catch { return false; }
    }

    private async Task<bool> SendEmail(IReadOnlyDictionary<string, string> cfg, string subject, string body, CancellationToken ct)
    {
        try
        {
            var host = cfg[NotificationKeys.SmtpHost];
            var port = int.TryParse(cfg.GetValueOrDefault(NotificationKeys.SmtpPort), out var p) ? p : 587;
            var from = cfg.GetValueOrDefault(NotificationKeys.SmtpFrom, cfg.GetValueOrDefault(NotificationKeys.SmtpUser, ""));
            var to = cfg.GetValueOrDefault(NotificationKeys.SmtpTo, from);
            if (string.IsNullOrWhiteSpace(from) || string.IsNullOrWhiteSpace(to)) return false;

            using var client = new SmtpClient(host, port) { EnableSsl = true };
            if (cfg.TryGetValue(NotificationKeys.SmtpUser, out var user) && !string.IsNullOrWhiteSpace(user))
                client.Credentials = new NetworkCredential(user, cfg.GetValueOrDefault(NotificationKeys.SmtpPass, ""));

            using var mail = new MailMessage { From = new MailAddress(from), Subject = subject, Body = body };
            foreach (var rcpt in to.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                mail.To.Add(rcpt);

            await client.SendMailAsync(mail, ct);
            return true;
        }
        catch { return false; }
    }

    private async Task<bool> SendWebhook(string url, string level, string title, string message, CancellationToken ct)
    {
        try
        {
            var json = JsonSerializer.Serialize(new { level, title, message });
            using var res = await http.PostAsync(url, JsonContent(json), ct);
            return res.IsSuccessStatusCode;
        }
        catch { return false; }
    }

    private static StringContent JsonContent(string json) => new(json, Encoding.UTF8, "application/json");
}
