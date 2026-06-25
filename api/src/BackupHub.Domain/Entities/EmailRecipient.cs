using BackupHub.Domain.Common;

namespace BackupHub.Domain.Entities;

public class EmailRecipient : BaseEntity
{
    public string Email { get; set; } = default!;
    public string? Name { get; set; }
    public string? Lang { get; set; }
}
