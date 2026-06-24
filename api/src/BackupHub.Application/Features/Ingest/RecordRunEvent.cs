using BackupHub.Application.Abstractions;
using BackupHub.Domain.Entities;
using BackupHub.Domain.Enums;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Application.Features.Ingest;

public sealed record RecordRunEventCommand(
    Guid AgentId,
    Guid JobId,
    RunType Type,
    RunStatus Status,
    DateTimeOffset StartedAt,
    DateTimeOffset? FinishedAt,
    long Bytes,
    string? Message) : IRequest<Guid>;

internal sealed class RecordRunEventHandler(IAppDbContext db)
    : IRequestHandler<RecordRunEventCommand, Guid>
{
    public async ValueTask<Guid> Handle(RecordRunEventCommand command, CancellationToken ct)
    {
        var run = new BackupRun
        {
            AgentId = command.AgentId,
            JobId = command.JobId,
            Type = command.Type,
            Status = command.Status,
            StartedAt = command.StartedAt,
            FinishedAt = command.FinishedAt,
            Bytes = command.Bytes,
            Message = command.Message,
        };
        db.Runs.Add(run);

        var agent = await db.Agents.FirstOrDefaultAsync(a => a.Id == command.AgentId, ct);
        if (agent is not null)
            agent.LastSeenAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);
        return run.Id;
    }
}
