using BackupHub.Domain.Common;
using BackupHub.Domain.Enums;

namespace BackupHub.Domain.Entities;

public class BackupRun : BaseEntity
{
    public Guid JobId { get; set; }
    public BackupJob Job { get; set; } = default!;

    public Guid AgentId { get; set; }
    public RunType Type { get; set; }
    public RunStatus Status { get; set; }

    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? FinishedAt { get; set; }
    public long Bytes { get; set; }
    public string? Message { get; set; }
}
