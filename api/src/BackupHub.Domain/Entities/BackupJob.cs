using BackupHub.Domain.Common;

namespace BackupHub.Domain.Entities;

// A backup job IS a "project": it bundles one or more related sources (e.g. a
// PostgreSQL database + its MinIO bucket) backed up together as one consistent,
// point-in-time version. The agent runs every source in a single combined run.
public class BackupJob : BaseEntity
{
    public string Name { get; set; } = default!;
    public bool Enabled { get; set; } = true;

    // The project this job backs up. JobSources is the chosen subset of that
    // project's sources (defaults to all of them).
    public Guid ProjectId { get; set; }
    public Project Project { get; set; } = default!;

    public ICollection<JobSource> JobSources { get; set; } = [];

    public Guid RemoteId { get; set; }
    public Remote Remote { get; set; } = default!;

    public Guid? AgentId { get; set; }
    public Agent? Agent { get; set; }

    public string BackupSchedule { get; set; } = "0 2 * * *";
    public string? UploadSchedule { get; set; }
    public string? CleanupSchedule { get; set; }
    public string? DrillSchedule { get; set; }

    public int MinLocalBackups { get; set; } = 2;
    public int MaxLocalBackups { get; set; } = 5;
    public int MaxRemoteBackups { get; set; } = 30;
    public int CompressionLevel { get; set; } = 6;
    public string? BackupPasswordEncrypted { get; set; }

    public ICollection<BackupRun> Runs { get; set; } = [];
}
