using BackupHub.Domain.Common;
using BackupHub.Domain.Enums;

namespace BackupHub.Domain.Entities;

public class AgentCommand : BaseEntity
{
    public Guid AgentId { get; set; }
    public CommandKind Kind { get; set; }
    public Guid? JobId { get; set; }
    public DateTimeOffset? AckedAt { get; set; }
}
