using BackupHub.Domain.Common;

namespace BackupHub.Domain.Entities;

public class TelegramChat : BaseEntity
{
    public string ChatId { get; set; } = default!;
    public string? Label { get; set; }
    public string? Lang { get; set; }
    public string? Code { get; set; }
    public bool Confirmed { get; set; }
}
