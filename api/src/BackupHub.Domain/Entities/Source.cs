using BackupHub.Domain.Common;
using BackupHub.Domain.Enums;

namespace BackupHub.Domain.Entities;

public class Source : BaseEntity
{
    public string Name { get; set; } = default!;

    // The project this source belongs to (sources are managed inside a project).
    public Guid ProjectId { get; set; }
    public Project Project { get; set; } = default!;

    public BackupEngine Engine { get; set; }
    public string Host { get; set; } = default!;
    public int Port { get; set; }
    public string Username { get; set; } = default!;
    public string SecretEncrypted { get; set; } = default!;
    public string Target { get; set; } = default!;

    // Discovery metadata. Manual sources are Confirmed by default; sources an
    // agent auto-discovers arrive Confirmed=false and wait for review in the UI.
    public SourceOrigin Origin { get; set; } = SourceOrigin.Manual;
    public bool Confirmed { get; set; } = true;
    public SourceVisibility Visibility { get; set; } = SourceVisibility.Private;
    public Guid? DiscoveredByAgentId { get; set; }
}
