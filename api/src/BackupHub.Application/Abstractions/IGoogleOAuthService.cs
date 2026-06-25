namespace BackupHub.Application.Abstractions;

public interface IGoogleOAuthService
{
    Task<bool> IsConfiguredAsync(CancellationToken ct = default);
    Task<string> BuildAuthUrlAsync(string state, string redirectUri, CancellationToken ct = default);
    Task<string> ExchangeCodeAsync(string code, string redirectUri, CancellationToken ct = default);
}
