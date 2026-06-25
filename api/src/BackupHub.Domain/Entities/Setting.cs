using BackupHub.Domain.Common;

namespace BackupHub.Domain.Entities;

public class Setting : BaseEntity
{
    public string Key { get; set; } = default!;
    public string ValueEncrypted { get; set; } = default!;
}
