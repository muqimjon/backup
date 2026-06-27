using System.Text.Json;
using BackupHub.Application.Abstractions;
using BackupHub.Application.Common;
using BackupHub.Domain.Entities;
using BackupHub.Domain.Enums;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Application.Features.Backups;

public sealed record BackupVersionDto(
    Guid Id,
    string FileName,
    string Driver,
    long Bytes,
    DateTimeOffset ArchivedAt,
    ArtifactLocation Location,
    DrillStatus DrillStatus,
    DateTimeOffset? DrilledAt,
    int? DrillTables,
    long? DrillRows);

public sealed record GetBackupVersionsQuery(Guid JobId) : IRequest<IReadOnlyList<BackupVersionDto>>;

internal sealed class GetBackupVersionsHandler(IAppDbContext db)
    : IRequestHandler<GetBackupVersionsQuery, IReadOnlyList<BackupVersionDto>>
{
    public async ValueTask<IReadOnlyList<BackupVersionDto>> Handle(GetBackupVersionsQuery query, CancellationToken ct)
        => await db.Artifacts
            .Where(a => a.JobId == query.JobId)
            .OrderByDescending(a => a.ArchivedAt)
            .Select(a => new BackupVersionDto(a.Id, a.FileName, a.Driver, a.Bytes, a.ArchivedAt, a.Location,
                a.DrillStatus, a.DrilledAt, a.DrillTables, a.DrillRows))
            .ToListAsync(ct);
}

public sealed record InventoryItem(string FileName, string Driver, long Bytes, DateTimeOffset ArchivedAt, ArtifactLocation Location);

public sealed record RecordInventoryCommand(Guid AgentId, Guid JobId, IReadOnlyList<InventoryItem> Items) : IRequest<int>;

internal sealed class RecordInventoryHandler(IAppDbContext db)
    : IRequestHandler<RecordInventoryCommand, int>
{
    public async ValueTask<int> Handle(RecordInventoryCommand command, CancellationToken ct)
    {
        // Upsert by FileName instead of wiping the table, so a drill result
        // ("verified"/"failed") survives the next inventory re-scan.
        var existing = await db.Artifacts.Where(a => a.JobId == command.JobId).ToListAsync(ct);
        var seen = new HashSet<string>(StringComparer.Ordinal);

        foreach (var item in command.Items)
        {
            seen.Add(item.FileName);
            var row = existing.FirstOrDefault(a => a.FileName == item.FileName);
            if (row is null)
            {
                db.Artifacts.Add(new BackupArtifact
                {
                    JobId = command.JobId,
                    FileName = item.FileName,
                    Driver = item.Driver,
                    Bytes = item.Bytes,
                    ArchivedAt = item.ArchivedAt,
                    Location = item.Location,
                });
            }
            else
            {
                row.Driver = item.Driver;
                row.Bytes = item.Bytes;
                row.ArchivedAt = item.ArchivedAt;
                row.Location = item.Location;
                // DrillStatus / DrilledAt / DrillTables / DrillRows kept as-is.
            }
        }

        // Drop only the archives that are genuinely gone from storage.
        foreach (var gone in existing.Where(a => !seen.Contains(a.FileName)))
            db.Artifacts.Remove(gone);

        var agent = await db.Agents.FirstOrDefaultAsync(a => a.Id == command.AgentId, ct);
        if (agent is not null)
            agent.LastSeenAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);
        return command.Items.Count;
    }
}

// An agent reports the outcome of drilling one specific archive. Persists the
// verdict on the artifact and pushes a toast to the browser.
public sealed record RecordDrillResultCommand(
    Guid AgentId, Guid JobId, string FileName, bool Ok, int Tables, long Rows, string? Message) : IRequest<bool>;

internal sealed class RecordDrillResultHandler(IAppDbContext db, IRunNotifier notifier)
    : IRequestHandler<RecordDrillResultCommand, bool>
{
    public async ValueTask<bool> Handle(RecordDrillResultCommand command, CancellationToken ct)
    {
        var artifact = await db.Artifacts
            .FirstOrDefaultAsync(a => a.JobId == command.JobId && a.FileName == command.FileName, ct);
        if (artifact is not null)
        {
            artifact.DrillStatus = command.Ok ? DrillStatus.Verified : DrillStatus.Failed;
            artifact.DrilledAt = DateTimeOffset.UtcNow;
            artifact.DrillTables = command.Ok ? command.Tables : null;
            artifact.DrillRows = command.Ok ? command.Rows : null;
            await db.SaveChangesAsync(ct);
        }

        var msg = command.Ok
            ? $"✓ Verified: {command.FileName} — {command.Tables} tables · {command.Rows:N0} rows"
            : $"✗ Drill failed: {command.FileName}{(string.IsNullOrWhiteSpace(command.Message) ? "" : " — " + command.Message)}";
        await notifier.PublishTest(new TestResultBroadcast("drill", command.JobId, command.Ok, msg), ct);
        return true;
    }
}

// Drill one specific archive on demand (the per-version "Drill" button).
public sealed record DrillVersionCommand(Guid JobId, string FileName) : IRequest<Guid>;

internal sealed class DrillVersionHandler(IAppDbContext db)
    : IRequestHandler<DrillVersionCommand, Guid>
{
    public async ValueTask<Guid> Handle(DrillVersionCommand command, CancellationToken ct)
    {
        var job = await db.Jobs.FirstOrDefaultAsync(j => j.Id == command.JobId, ct)
            ?? throw new NotFoundException("Job not found");
        if (job.AgentId is null)
            throw new ConflictException("This job has no agent assigned");

        var cmd = new AgentCommand
        {
            AgentId = job.AgentId.Value,
            Kind = CommandKind.RunDrill,
            JobId = command.JobId,
            Payload = JsonSerializer.Serialize(new { file = command.FileName }),
        };
        db.Commands.Add(cmd);
        await db.SaveChangesAsync(ct);
        return cmd.Id;
    }
}

// Delete one archive (local + remote) — e.g. a drill-failed one that shouldn't
// keep occupying a retention slot.
public sealed record DeleteArtifactCommand(Guid JobId, string FileName) : IRequest<Guid>;

internal sealed class DeleteArtifactHandler(IAppDbContext db)
    : IRequestHandler<DeleteArtifactCommand, Guid>
{
    public async ValueTask<Guid> Handle(DeleteArtifactCommand command, CancellationToken ct)
    {
        var job = await db.Jobs.FirstOrDefaultAsync(j => j.Id == command.JobId, ct)
            ?? throw new NotFoundException("Job not found");
        if (job.AgentId is null)
            throw new ConflictException("This job has no agent assigned");

        var cmd = new AgentCommand
        {
            AgentId = job.AgentId.Value,
            Kind = CommandKind.DeleteArtifact,
            JobId = command.JobId,
            Payload = JsonSerializer.Serialize(new { file = command.FileName }),
        };
        db.Commands.Add(cmd);
        await db.SaveChangesAsync(ct);
        return cmd.Id;
    }
}

public sealed record DeliverArtifactCommand(Guid JobId, string FileName) : IRequest<Guid>;

internal sealed class DeliverArtifactHandler(IAppDbContext db)
    : IRequestHandler<DeliverArtifactCommand, Guid>
{
    public async ValueTask<Guid> Handle(DeliverArtifactCommand command, CancellationToken ct)
    {
        var job = await db.Jobs.FirstOrDefaultAsync(j => j.Id == command.JobId, ct)
            ?? throw new NotFoundException("Job not found");
        if (job.AgentId is null)
            throw new ConflictException("This job has no agent assigned");

        var payload = JsonSerializer.Serialize(new { file = command.FileName });
        var cmd = new AgentCommand
        {
            AgentId = job.AgentId.Value,
            Kind = CommandKind.DeliverArtifact,
            JobId = command.JobId,
            Payload = payload,
        };
        db.Commands.Add(cmd);
        await db.SaveChangesAsync(ct);
        return cmd.Id;
    }
}

// Restore a whole project to a point-in-time Version (every source's archive of
// that timestamp restored together) — or a single FileName for advanced per-source
// restore. Version takes precedence when both are given.
public sealed record RestoreVersionCommand(Guid JobId, string? FileName, string? Version, bool SnapshotFirst) : IRequest<Guid>;

internal sealed class RestoreVersionHandler(IAppDbContext db)
    : IRequestHandler<RestoreVersionCommand, Guid>
{
    public async ValueTask<Guid> Handle(RestoreVersionCommand command, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(command.Version) && string.IsNullOrWhiteSpace(command.FileName))
            throw new ConflictException("Specify a version or a file to restore");

        var job = await db.Jobs.FirstOrDefaultAsync(j => j.Id == command.JobId, ct)
            ?? throw new NotFoundException("Job not found");
        if (job.AgentId is null)
            throw new ConflictException("This job has no agent assigned");

        // For a version restore, hand the agent the exact archive names recorded
        // for that version (authoritative — independent of the current project
        // name or source set). The agent restores all of them or none, so a
        // pruned/missing source can never produce a silent partial rollback.
        List<string>? files = null;
        if (!string.IsNullOrWhiteSpace(command.Version))
        {
            var suffix = "_" + command.Version + ".zip";
            files = await db.Artifacts
                .Where(a => a.JobId == command.JobId && a.FileName.EndsWith(suffix))
                .Select(a => a.FileName)
                .ToListAsync(ct);
            if (files.Count == 0)
                throw new NotFoundException("No archives are recorded for that version");
        }

        var payload = JsonSerializer.Serialize(new { file = command.FileName, version = command.Version, files, snapshot = command.SnapshotFirst });
        var cmd = new AgentCommand
        {
            AgentId = job.AgentId.Value,
            Kind = CommandKind.RestoreVersion,
            JobId = command.JobId,
            Payload = payload,
        };
        db.Commands.Add(cmd);
        await db.SaveChangesAsync(ct);
        return cmd.Id;
    }
}
