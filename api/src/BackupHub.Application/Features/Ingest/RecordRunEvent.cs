using BackupHub.Application.Abstractions;
using BackupHub.Application.Common;
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

internal sealed class RecordRunEventHandler(
    IAppDbContext db,
    IMetricsRecorder metrics,
    IRunNotifier notifier,
    INotificationSender notifications)
    : IRequestHandler<RecordRunEventCommand, Guid>
{
    public async ValueTask<Guid> Handle(RecordRunEventCommand command, CancellationToken ct)
    {
        var job = await db.Jobs
            .Include(j => j.JobSources).ThenInclude(js => js.Source)
            .FirstOrDefaultAsync(j => j.Id == command.JobId, ct);

        // An authenticated agent may only report runs for jobs assigned to it.
        if (job is { AgentId: not null } && job.AgentId != command.AgentId)
            throw new UnauthorizedAppException("Job is not assigned to this agent.");

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

        var project = agent?.Project ?? "backup";
        // Combined run → one label joining each source's driver (e.g. "postgres-minio").
        var driver = job is null || job.JobSources.Count == 0
            ? "unknown"
            : string.Join('-', job.JobSources.OrderBy(js => js.Position).Select(js => DriverName(js.Source.Engine)));
        var duration = command.FinishedAt is { } end ? (end - command.StartedAt).TotalSeconds : 0;

        metrics.RecordRun(project, driver, command.Type, command.Status, command.Bytes, duration);

        await notifier.Publish(new RunBroadcast(
            run.Id, run.JobId, job?.Name ?? "—", project, driver,
            run.Type, run.Status, run.StartedAt, run.FinishedAt, run.Bytes, run.Message), ct);

        if (command.Status is RunStatus.Ok or RunStatus.Fail)
            await notifications.DispatchRunAsync(command.Type, command.Status, project, job?.Name ?? driver, command.Message, ct);

        return run.Id;
    }

    private static string DriverName(BackupEngine engine) => engine switch
    {
        BackupEngine.Postgres => "postgres",
        BackupEngine.MySql => "mysql",
        BackupEngine.Mssql => "mssql",
        BackupEngine.Minio => "minio",
        _ => "unknown",
    };
}
