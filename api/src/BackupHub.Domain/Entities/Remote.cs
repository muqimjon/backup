using BackupHub.Domain.Common;
using BackupHub.Domain.Enums;

namespace BackupHub.Domain.Entities;

public class Remote : BaseEntity
{
    public string Name { get; set; } = default!;
    public RemoteType Type { get; set; }
    public string Path { get; set; } = default!;
    public string ConfigEncrypted { get; set; } = default!;
}
