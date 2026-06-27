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

    // Restore-drill outcome for this exact archive. Preserved across inventory
    // re-scans (matched by FileName) so a "verified" badge survives.
    public DrillStatus DrillStatus { get; set; } = DrillStatus.Untested;
    public DateTimeOffset? DrilledAt { get; set; }
    public int? DrillTables { get; set; }
    public long? DrillRows { get; set; }
}
