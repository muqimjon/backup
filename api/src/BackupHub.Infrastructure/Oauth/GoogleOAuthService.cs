using System.Text.Json;
using BackupHub.Application.Abstractions;
using Microsoft.Extensions.Configuration;

namespace BackupHub.Infrastructure.Oauth;

public sealed class GoogleOAuthService(HttpClient http, ISettingsService settings, IConfiguration config)
    : IGoogleOAuthService
{
    public const string ClientIdKey = "Google.ClientId";
    public const string ClientSecretKey = "Google.ClientSecret";
    private const string Scope = "https://www.googleapis.com/auth/drive";

    public async Task<bool> IsConfiguredAsync(CancellationToken ct = default)
    {
        var (id, secret) = await ResolveAsync(ct);
        return !string.IsNullOrWhiteSpace(id) && !string.IsNullOrWhiteSpace(secret);
    }

    public async Task<string> BuildAuthUrlAsync(string state, string redirectUri, CancellationToken ct = default)
    {
        var (clientId, _) = await ResolveAsync(ct);
        var query = new Dictionary<string, string?>
        {
            ["client_id"] = clientId,
            ["redirect_uri"] = redirectUri,
            ["response_type"] = "code",
            ["scope"] = Scope,
            ["access_type"] = "offline",
            ["prompt"] = "consent",
            ["state"] = state,
        };
        var qs = string.Join('&', query.Select(kv => $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value ?? string.Empty)}"));
        return $"https://accounts.google.com/o/oauth2/v2/auth?{qs}";
    }

    public async Task<string> ExchangeCodeAsync(string code, string redirectUri, CancellationToken ct = default)
    {
        var (clientId, clientSecret) = await ResolveAsync(ct);
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["code"] = code,
            ["client_id"] = clientId ?? string.Empty,
            ["client_secret"] = clientSecret ?? string.Empty,
            ["redirect_uri"] = redirectUri,
            ["grant_type"] = "authorization_code",
        });

        using var response = await http.PostAsync("https://oauth2.googleapis.com/token", form, ct);
        response.EnsureSuccessStatusCode();

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var root = doc.RootElement;
        var accessToken = root.GetProperty("access_token").GetString();
        var refreshToken = root.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;
        var expiresIn = root.TryGetProperty("expires_in", out var ei) ? ei.GetInt32() : 3600;
        var expiry = DateTimeOffset.UtcNow.AddSeconds(expiresIn).ToString("yyyy-MM-ddTHH:mm:ss.fffffffzzz");

        return JsonSerializer.Serialize(new
        {
            access_token = accessToken,
            token_type = "Bearer",
            refresh_token = refreshToken,
            expiry,
        });
    }

    private async Task<(string? ClientId, string? ClientSecret)> ResolveAsync(CancellationToken ct)
    {
        var stored = await settings.GetManyAsync([ClientIdKey, ClientSecretKey], ct);
        var id = stored.GetValueOrDefault(ClientIdKey) ?? config["Google:ClientId"];
        var secret = stored.GetValueOrDefault(ClientSecretKey) ?? config["Google:ClientSecret"];
        return (id, secret);
    }
}
