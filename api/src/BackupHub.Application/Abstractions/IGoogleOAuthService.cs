namespace BackupHub.Application.Abstractions;

public interface IGoogleOAuthService
{
    string BuildAuthUrl(string state, string redirectUri);
    Task<string> ExchangeCodeAsync(string code, string redirectUri, CancellationToken ct = default);
}
