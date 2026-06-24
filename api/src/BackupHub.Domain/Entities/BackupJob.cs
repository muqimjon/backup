using BackupHub.Domain.Common;

namespace BackupHub.Domain.Entities;

public class BackupJob : BaseEntity
{
    public string Name { get; set; } = default!;
    public bool Enabled { get; set; } = true;

    public Guid SourceId { get; set; }
    public Source Source { get; set; } = default!;

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
