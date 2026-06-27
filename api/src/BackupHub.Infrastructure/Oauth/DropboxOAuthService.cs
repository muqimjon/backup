using System.Text.Json;
using BackupHub.Application.Abstractions;
using Microsoft.Extensions.Configuration;

namespace BackupHub.Infrastructure.Oauth;

public sealed class DropboxOAuthService(HttpClient http, ISettingsService settings, IConfiguration config)
    : IDropboxOAuthService
{
    public const string ClientIdKey = "Dropbox.ClientId";
    public const string ClientSecretKey = "Dropbox.ClientSecret";
    private const string Authorize = "https://www.dropbox.com/oauth2/authorize";
    private const string Token = "https://api.dropboxapi.com/oauth2/token";

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
            ["token_access_type"] = "offline",
            // Re-show the approval screen so a different Dropbox account can be linked.
            ["force_reapprove"] = "true",
            ["state"] = state,
        };
        var qs = string.Join('&', query.Select(kv => $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value ?? string.Empty)}"));
        return $"{Authorize}?{qs}";
    }

    public async Task<string> ExchangeCodeAsync(string code, string redirectUri, CancellationToken ct = default)
    {
        var (clientId, clientSecret) = await ResolveAsync(ct);
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["code"] = code,
            ["grant_type"] = "authorization_code",
            ["client_id"] = clientId ?? string.Empty,
            ["client_secret"] = clientSecret ?? string.Empty,
            ["redirect_uri"] = redirectUri,
        });

        using var response = await http.PostAsync(Token, form, ct);
        response.EnsureSuccessStatusCode();

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var root = doc.RootElement;
        var accessToken = root.GetProperty("access_token").GetString();
        var refreshToken = root.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;
        var expiresIn = root.TryGetProperty("expires_in", out var ei) ? ei.GetInt32() : 14400;
        var expiry = DateTimeOffset.UtcNow.AddSeconds(expiresIn).ToString("yyyy-MM-ddTHH:mm:ss.fffffff'Z'", System.Globalization.CultureInfo.InvariantCulture);

        return OauthJson.Serialize(new
        {
            access_token = accessToken,
            token_type = "bearer",
            refresh_token = refreshToken,
            expiry,
        });
    }

    private async Task<(string? ClientId, string? ClientSecret)> ResolveAsync(CancellationToken ct)
    {
        var stored = await settings.GetManyAsync([ClientIdKey, ClientSecretKey], ct);
        var id = stored.GetValueOrDefault(ClientIdKey) ?? config["Dropbox:ClientId"];
        var secret = stored.GetValueOrDefault(ClientSecretKey) ?? config["Dropbox:ClientSecret"];
        return (id, secret);
    }
}
