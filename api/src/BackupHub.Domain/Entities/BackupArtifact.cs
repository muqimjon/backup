using BackupHub.Domain.Common;
using BackupHub.Domain.Enums;

namespace BackupHub.Domain.Entities;

public class BackupArtifact : BaseEntity
{
    public Guid JobId { get; set; }
    public string FileName { get; set; } = default!;
    public string Driver { get; set; } = default!;
    public long Bytes { get; set; }
    public DateTimeOffset ArchivedAt { get; set; }
    public ArtifactLocation Location { get; set; }
}
