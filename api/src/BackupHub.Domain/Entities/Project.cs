using BackupHub.Domain.Common;

namespace BackupHub.Domain.Entities;

// A project groups the related sources of one application (e.g. a PostgreSQL
// database + its S3 bucket). Backup jobs target a project and back up its sources
// together as one consistent, point-in-time version.
public class Project : BaseEntity
{
    public string Name { get; set; } = default!;

    public ICollection<Source> Sources { get; set; } = [];
}
