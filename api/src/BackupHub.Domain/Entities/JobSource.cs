using BackupHub.Domain.Common;

namespace BackupHub.Domain.Entities;

// Join between a backup job ("project") and the sources it backs up as ONE
// consistent run. Position fixes the driver order the agent runs them in
// (databases first, object storage last) so the DB dump never references an
// object the mirror is missing.
public class JobSource : BaseEntity
{
    public Guid JobId { get; set; }
    public BackupJob Job { get; set; } = default!;

    public Guid SourceId { get; set; }
    public Source Source { get; set; } = default!;

    public int Position { get; set; }
}
