namespace BackupHub.Application.Abstractions;

public interface ISecretProtector
{
    string Protect(string plaintext);
    string Unprotect(string cipher);
}

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string hash);
}

public interface IJwtTokenService
{
    string CreateToken(Guid userId, string username, string role);
}

public interface IRcloneConfigFactory
{
    string Build(Domain.Entities.Remote remote);
}

public interface ISettingsService
{
    Task<string?> GetAsync(string key, CancellationToken ct = default);
    Task<IReadOnlyDictionary<string, string>> GetManyAsync(IEnumerable<string> keys, CancellationToken ct = default);
    Task SetAsync(string key, string? value, CancellationToken ct = default);
}

public interface INotificationSender
{
    Task DispatchRunAsync(Domain.Enums.RunType type, Domain.Enums.RunStatus status, string project, string driver, string? message, CancellationToken ct = default);
    Task<string> SendTestAsync(CancellationToken ct = default);
    Task<string?> ValidateTelegramTokenAsync(string token, CancellationToken ct = default);
}
