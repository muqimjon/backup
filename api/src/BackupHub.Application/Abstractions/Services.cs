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
