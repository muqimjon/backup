using System.Net;
using System.Net.Mail;
using System.Text;
using System.Text.Json;
using BackupHub.Application.Abstractions;
using BackupHub.Domain.Enums;
using BackupHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Infrastructure.Notifications;

public sealed class NotificationSender(HttpClient http, ISettingsService settings, AppDbContext db)
    : INotificationSender
{
    private const string LangKey = "App.Lang";

    private static readonly Dictionary<string, Dictionary<RunType, string>> RunWords = new()
    {
        ["en"] = new() { [RunType.Backup] = "Backup", [RunType.Upload] = "Upload", [RunType.Cleanup] = "Cleanup", [RunType.Drill] = "Restore drill", [RunType.Restore] = "Restore", [RunType.Test] = "Connection test" },
        ["ru"] = new() { [RunType.Backup] = "Резервная копия", [RunType.Upload] = "Загрузка", [RunType.Cleanup] = "Очистка", [RunType.Drill] = "Проверка восстановления", [RunType.Restore] = "Восстановление", [RunType.Test] = "Проверка соединения" },
        ["uz"] = new() { [RunType.Backup] = "Backup", [RunType.Upload] = "Yuklash", [RunType.Cleanup] = "Tozalash", [RunType.Drill] = "Tiklash sinovi", [RunType.Restore] = "Tiklash", [RunType.Test] = "Ulanish testi" },
    };

    private static readonly Dictionary<string, (string Ok, string Fail, string Test)> Words = new()
    {
        ["en"] = ("OK", "FAILED", "✅ Test notification from Zaxira."),
        ["ru"] = ("УСПЕХ", "СБОЙ", "✅ Тестовое уведомление от Zaxira."),
        ["uz"] = ("OK", "XATO", "✅ Zaxira'dan test bildirishnomasi."),
    };

    public async Task DispatchRunAsync(RunType type, RunStatus status, string project, string driver, string? message, CancellationToken ct = default)
    {
        var cfg = await settings.GetManyAsync(NotificationKeys.All, ct);
        var mode = cfg.GetValueOrDefault(NotificationKeys.NotifyOn, "failure");
        var level = status == RunStatus.Fail ? "error" : "success";

        if (mode == "never") return;
        if (mode == "failure" && level != "error") return;

        await Send(cfg, level, lang =>
        {
            var runWord = RunWords[lang].GetValueOrDefault(type, type.ToString());
            var (ok, fail, _) = Words[lang];
            return ($"{project} · {runWord} {(status == RunStatus.Fail ? fail : ok)}", $"{driver}: {message ?? runWord}");
        }, ct);
    }

    public async Task<string> SendTestAsync(CancellationToken ct = default)
    {
        var cfg = await settings.GetManyAsync(NotificationKeys.All, ct);
        var sent = await Send(cfg, "info", lang => ("Zaxira", Words[lang].Test), ct);
        return sent.Count == 0 ? "No channels configured (add a recipient/chat first)." : "Sent via: " + string.Join(", ", sent);
    }

    public async Task<string?> ValidateTelegramTokenAsync(string token, CancellationToken ct = default)
    {
        try
        {
            using var res = await http.GetAsync($"https://api.telegram.org/bot{token}/getMe", ct);
            if (!res.IsSuccessStatusCode) return "Telegram rejected this bot token.";
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
            return doc.RootElement.TryGetProperty("ok", out var ok) && ok.GetBoolean() ? null : "Telegram rejected this bot token.";
        }
        catch { return "Could not reach Telegram to verify the token."; }
    }

    private async Task<List<string>> Send(IReadOnlyDictionary<string, string> cfg, string level, Func<string, (string Title, string Body)> build, CancellationToken ct)
    {
        var appLang = await ResolveLang(ct);
        var icon = level switch { "error" => "🔴", "success" => "✅", _ => "ℹ️" };
        string Norm(string? l) => l is "ru" or "uz" or "en" ? l : appLang;
        var sent = new List<string>();

        if (cfg.TryGetValue(NotificationKeys.TelegramBotToken, out var token) && !string.IsNullOrWhiteSpace(token))
        {
            var chats = await db.TelegramChats.Where(c => c.Confirmed).Select(c => new { c.ChatId, c.Lang }).ToListAsync(ct);
            var ok = false;
            foreach (var chat in chats)
            {
                var (title, body) = build(Norm(chat.Lang));
                ok |= await SendTelegram(token, chat.ChatId, $"{icon} {title}\n{body}", ct);
            }
            if (ok) sent.Add("Telegram");
        }

        if (cfg.TryGetValue(NotificationKeys.SmtpHost, out var host) && !string.IsNullOrWhiteSpace(host))
        {
            var recipients = await db.EmailRecipients.Select(r => new { r.Email, r.Lang }).ToListAsync(ct);
            var ok = false;
            foreach (var r in recipients)
            {
                var (title, body) = build(Norm(r.Lang));
                ok |= await SendEmail(cfg, r.Email, title, $"{icon} {title}\n{body}", ct);
            }
            if (ok) sent.Add("Email");
        }

        if (cfg.TryGetValue(NotificationKeys.WebhookUrl, out var url) && !string.IsNullOrWhiteSpace(url))
        {
            var (title, body) = build(appLang);
            if (await SendWebhook(url, level, title, body, ct)) sent.Add("Webhook");
        }

        return sent;
    }

    private async Task<bool> SendTelegram(string token, string chatId, string text, CancellationToken ct)
    {
        try
        {
            var url = $"https://api.telegram.org/bot{token}/sendMessage";
            var payload = JsonBody($"{{\"chat_id\":\"{chatId}\",\"text\":{JsonSerializer.Serialize(text)},\"disable_web_page_preview\":true}}");
            using var res = await http.PostAsync(url, payload, ct);
            return res.IsSuccessStatusCode;
        }
        catch { return false; }
    }

    private async Task<bool> SendEmail(IReadOnlyDictionary<string, string> cfg, string to, string subject, string body, CancellationToken ct)
    {
        try
        {
            var host = cfg[NotificationKeys.SmtpHost];
            var port = int.TryParse(cfg.GetValueOrDefault(NotificationKeys.SmtpPort), out var p) ? p : 587;
            var from = cfg.GetValueOrDefault(NotificationKeys.SmtpFrom, cfg.GetValueOrDefault(NotificationKeys.SmtpUser, ""));
            if (string.IsNullOrWhiteSpace(from)) return false;

            using var client = new SmtpClient(host, port) { EnableSsl = true };
            if (cfg.TryGetValue(NotificationKeys.SmtpUser, out var user) && !string.IsNullOrWhiteSpace(user))
                client.Credentials = new NetworkCredential(user, cfg.GetValueOrDefault(NotificationKeys.SmtpPass, ""));

            using var mail = new MailMessage(from, to, subject, body);
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
            using var res = await http.PostAsync(url, JsonBody(json), ct);
            return res.IsSuccessStatusCode;
        }
        catch { return false; }
    }

    private async Task<string> ResolveLang(CancellationToken ct)
    {
        var lang = await settings.GetAsync(LangKey, ct);
        return lang is "ru" or "uz" ? lang : "en";
    }

    private static StringContent JsonBody(string json) => new(json, Encoding.UTF8, "application/json");
}
