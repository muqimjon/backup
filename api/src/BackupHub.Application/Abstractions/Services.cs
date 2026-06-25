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
    Task DispatchAsync(string level, string title, string message, CancellationToken ct = default);
    Task<string> SendTestAsync(CancellationToken ct = default);
}
