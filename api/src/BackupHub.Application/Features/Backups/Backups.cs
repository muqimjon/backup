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
    ArtifactLocation Location);

public sealed record GetBackupVersionsQuery(Guid JobId) : IRequest<IReadOnlyList<BackupVersionDto>>;

internal sealed class GetBackupVersionsHandler(IAppDbContext db)
    : IRequestHandler<GetBackupVersionsQuery, IReadOnlyList<BackupVersionDto>>
{
    public async ValueTask<IReadOnlyList<BackupVersionDto>> Handle(GetBackupVersionsQuery query, CancellationToken ct)
        => await db.Artifacts
            .Where(a => a.JobId == query.JobId)
            .OrderByDescending(a => a.ArchivedAt)
            .Select(a => new BackupVersionDto(a.Id, a.FileName, a.Driver, a.Bytes, a.ArchivedAt, a.Location))
            .ToListAsync(ct);
}

public sealed record InventoryItem(string FileName, string Driver, long Bytes, DateTimeOffset ArchivedAt, ArtifactLocation Location);

public sealed record RecordInventoryCommand(Guid AgentId, Guid JobId, IReadOnlyList<InventoryItem> Items) : IRequest<int>;

internal sealed class RecordInventoryHandler(IAppDbContext db)
    : IRequestHandler<RecordInventoryCommand, int>
{
    public async ValueTask<int> Handle(RecordInventoryCommand command, CancellationToken ct)
    {
        var existing = await db.Artifacts.Where(a => a.JobId == command.JobId).ToListAsync(ct);
        db.Artifacts.RemoveRange(existing);

        foreach (var item in command.Items)
            db.Artifacts.Add(new BackupArtifact
            {
                JobId = command.JobId,
                FileName = item.FileName,
                Driver = item.Driver,
                Bytes = item.Bytes,
                ArchivedAt = item.ArchivedAt,
                Location = item.Location,
            });

        var agent = await db.Agents.FirstOrDefaultAsync(a => a.Id == command.AgentId, ct);
        if (agent is not null)
            agent.LastSeenAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);
        return command.Items.Count;
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

public sealed record RestoreVersionCommand(Guid JobId, string FileName, bool SnapshotFirst) : IRequest<Guid>;

internal sealed class RestoreVersionHandler(IAppDbContext db)
    : IRequestHandler<RestoreVersionCommand, Guid>
{
    public async ValueTask<Guid> Handle(RestoreVersionCommand command, CancellationToken ct)
    {
        var job = await db.Jobs.FirstOrDefaultAsync(j => j.Id == command.JobId, ct)
            ?? throw new NotFoundException("Job not found");
        if (job.AgentId is null)
            throw new ConflictException("This job has no agent assigned");

        var payload = JsonSerializer.Serialize(new { file = command.FileName, snapshot = command.SnapshotFirst });
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
