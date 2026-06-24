using BackupHub.Domain.Common;
using BackupHub.Domain.Enums;

namespace BackupHub.Domain.Entities;

public class Source : BaseEntity
{
    public string Name { get; set; } = default!;
    public BackupEngine Engine { get; set; }
    public string Host { get; set; } = default!;
    public int Port { get; set; }
    public string Username { get; set; } = default!;
    public string SecretEncrypted { get; set; } = default!;
    public string Target { get; set; } = default!;
}
