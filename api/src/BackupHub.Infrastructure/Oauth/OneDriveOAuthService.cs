using System.Net.Http.Headers;
using System.Text.Json;
using BackupHub.Application.Abstractions;
using Microsoft.Extensions.Configuration;

namespace BackupHub.Infrastructure.Oauth;

public sealed class OneDriveOAuthService(HttpClient http, ISettingsService settings, IConfiguration config)
    : IOneDriveOAuthService
{
    public const string ClientIdKey = "OneDrive.ClientId";
    public const string ClientSecretKey = "OneDrive.ClientSecret";
    private const string Scope = "Files.ReadWrite.All offline_access";
    private const string Authorize = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
    private const string Token = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

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
            ["response_mode"] = "query",
            ["scope"] = Scope,
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
            ["client_id"] = clientId ?? string.Empty,
            ["client_secret"] = clientSecret ?? string.Empty,
            ["redirect_uri"] = redirectUri,
            ["grant_type"] = "authorization_code",
            ["scope"] = Scope,
        });

        using var response = await http.PostAsync(Token, form, ct);
        response.EnsureSuccessStatusCode();

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var root = doc.RootElement;
        var accessToken = root.GetProperty("access_token").GetString();
        var refreshToken = root.GetProperty("refresh_token").GetString();
        var expiresIn = root.GetProperty("expires_in").GetInt32();
        var expiry = DateTimeOffset.UtcNow.AddSeconds(expiresIn).ToString("yyyy-MM-ddTHH:mm:ss.fffffffzzz");

        var tokenJson = JsonSerializer.Serialize(new
        {
            access_token = accessToken,
            token_type = "Bearer",
            refresh_token = refreshToken,
            expiry,
        });

        var (driveId, driveType) = await GetDriveAsync(accessToken!, ct);

        return JsonSerializer.Serialize(new { token = tokenJson, driveId, driveType });
    }

    private async Task<(string DriveId, string DriveType)> GetDriveAsync(string accessToken, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "https://graph.microsoft.com/v1.0/me/drive");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        using var response = await http.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var root = doc.RootElement;
        var id = root.GetProperty("id").GetString() ?? "";
        var type = root.TryGetProperty("driveType", out var t) ? t.GetString() ?? "personal" : "personal";
        return (id, type);
    }

    private async Task<(string? ClientId, string? ClientSecret)> ResolveAsync(CancellationToken ct)
    {
        var stored = await settings.GetManyAsync([ClientIdKey, ClientSecretKey], ct);
        var id = stored.GetValueOrDefault(ClientIdKey) ?? config["OneDrive:ClientId"];
        var secret = stored.GetValueOrDefault(ClientSecretKey) ?? config["OneDrive:ClientSecret"];
        return (id, secret);
    }
}
