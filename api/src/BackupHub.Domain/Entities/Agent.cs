using BackupHub.Domain.Common;

namespace BackupHub.Domain.Entities;

public class Agent : BaseEntity
{
    public string Name { get; set; } = default!;
    public string Hostname { get; set; } = default!;
    public string Project { get; set; } = default!;
    public string Drivers { get; set; } = default!;
    public string Version { get; set; } = default!;
    public string TokenHash { get; set; } = default!;
    public bool Enabled { get; set; } = true;
    public DateTimeOffset? LastSeenAt { get; set; }

    public ICollection<BackupJob> Jobs { get; set; } = [];
}
