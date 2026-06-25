using System.Text;
using System.Text.Json;
using BackupHub.Application.Abstractions;
using BackupHub.Domain.Entities;
using BackupHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace BackupHub.Infrastructure.Notifications;

public sealed class TelegramPoller(
    IHttpClientFactory httpFactory,
    IServiceScopeFactory scopeFactory,
    ILogger<TelegramPoller> logger) : BackgroundService
{
    private const string OffsetKey = "Telegram.Offset";

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        var http = httpFactory.CreateClient();
        http.Timeout = TimeSpan.FromSeconds(50);

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await PollOnce(http, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
            catch (Exception ex)
            {
                logger.LogDebug(ex, "Telegram poll failed");
                await Task.Delay(TimeSpan.FromSeconds(15), ct);
            }
        }
    }

    private async Task PollOnce(HttpClient http, CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var settings = scope.ServiceProvider.GetRequiredService<ISettingsService>();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var token = await settings.GetAsync(NotificationKeys.TelegramBotToken, ct);
        if (string.IsNullOrWhiteSpace(token))
        {
            await Task.Delay(TimeSpan.FromSeconds(15), ct);
            return;
        }

        var offset = int.TryParse(await settings.GetAsync(OffsetKey, ct), out var o) ? o : 0;
        var url = $"https://api.telegram.org/bot{token}/getUpdates?timeout=30&offset={offset}";
        using var res = await http.GetAsync(url, ct);
        if (!res.IsSuccessStatusCode)
        {
            await Task.Delay(TimeSpan.FromSeconds(15), ct);
            return;
        }

        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
        if (!doc.RootElement.TryGetProperty("result", out var updates)) return;

        var maxId = offset;
        foreach (var update in updates.EnumerateArray())
        {
            maxId = Math.Max(maxId, update.GetProperty("update_id").GetInt32() + 1);
            if (!update.TryGetProperty("message", out var msg)) continue;
            if (!msg.TryGetProperty("text", out var textEl)) continue;
            var text = textEl.GetString() ?? "";
            if (!text.StartsWith("/start", StringComparison.OrdinalIgnoreCase)) continue;

            var chat = msg.GetProperty("chat");
            var chatId = chat.GetProperty("id").GetRawText();
            var label = chat.TryGetProperty("username", out var un) ? un.GetString()
                : chat.TryGetProperty("first_name", out var fn) ? fn.GetString() : null;

            await HandleStart(http, db, token, chatId, label, ct);
        }

        if (maxId != offset)
            await settings.SetAsync(OffsetKey, maxId.ToString(), ct);
    }

    private async Task HandleStart(HttpClient http, AppDbContext db, string token, string chatId, string? label, CancellationToken ct)
    {
        var existing = await db.TelegramChats.FirstOrDefaultAsync(c => c.ChatId == chatId, ct);
        if (existing is { Confirmed: true })
        {
            await Send(http, token, chatId, "✅ This chat is already linked to BackupHub.", ct);
            return;
        }

        var code = Random.Shared.Next(0, 1_000_000).ToString("D6");
        if (existing is null)
            db.TelegramChats.Add(new TelegramChat { ChatId = chatId, Label = label, Code = code, Confirmed = false });
        else
        {
            existing.Code = code;
            existing.Label = label;
        }
        await db.SaveChangesAsync(ct);

        await Send(http, token, chatId, $"🔗 Your BackupHub link code is: {code}\nEnter it on the Settings → Notifications page.", ct);
    }

    private static async Task Send(HttpClient http, string token, string chatId, string text, CancellationToken ct)
    {
        var url = $"https://api.telegram.org/bot{token}/sendMessage";
        var body = new StringContent($"{{\"chat_id\":\"{chatId}\",\"text\":{JsonSerializer.Serialize(text)}}}", Encoding.UTF8, "application/json");
        try { using var _ = await http.PostAsync(url, body, ct); } catch { }
    }
}
