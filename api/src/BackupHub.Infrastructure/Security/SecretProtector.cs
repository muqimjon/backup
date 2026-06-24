using BackupHub.Application.Abstractions;
using Microsoft.AspNetCore.DataProtection;

namespace BackupHub.Infrastructure.Security;

public sealed class SecretProtector : ISecretProtector
{
    private readonly IDataProtector _protector;

    public SecretProtector(IDataProtectionProvider provider)
        => _protector = provider.CreateProtector("BackupHub.Secrets.v1");

    public string Protect(string plaintext) => _protector.Protect(plaintext);

    public string Unprotect(string cipher) => _protector.Unprotect(cipher);
}
