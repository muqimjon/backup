using BackupHub.Application.Abstractions;
using BackupHub.Domain.Enums;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Application.Features.Dashboard;

public sealed record StatsDto(
    int Agents,
    int Jobs,
    int Ok24h,
    int Fail24h,
    long LastBackupBytes,
    DateTimeOffset? LastSuccessAt,
    RunStatus? LastDrillStatus,
    DateTimeOffset? LastDrillAt);

public sealed record GetStatsQuery : IRequest<StatsDto>;

internal sealed class GetStatsHandler(IAppDbContext db)
    : IRequestHandler<GetStatsQuery, StatsDto>
{
    public async ValueTask<StatsDto> Handle(GetStatsQuery query, CancellationToken ct)
    {
        var since = DateTimeOffset.UtcNow.AddHours(-24);

        var agents = await db.Agents.CountAsync(ct);
        var jobs = await db.Jobs.CountAsync(ct);

        var recent = await db.Runs
            .Where(r => r.StartedAt >= since)
            .Select(r => new { r.Status, r.Type })
            .ToListAsync(ct);
        var ok24h = recent.Count(r => r.Status == RunStatus.Ok);
        var fail24h = recent.Count(r => r.Status == RunStatus.Fail);

        var lastBackup = await db.Runs
            .Where(r => r.Type == RunType.Backup && r.Status == RunStatus.Ok)
            .OrderByDescending(r => r.StartedAt)
            .Select(r => new { r.Bytes, r.StartedAt })
            .FirstOrDefaultAsync(ct);

        var lastDrill = await db.Runs
            .Where(r => r.Type == RunType.Drill && r.Status != RunStatus.Running)
            .OrderByDescending(r => r.StartedAt)
            .Select(r => new { r.Status, r.StartedAt })
            .FirstOrDefaultAsync(ct);

        return new StatsDto(
            agents,
            jobs,
            ok24h,
            fail24h,
            lastBackup?.Bytes ?? 0,
            lastBackup?.StartedAt,
            lastDrill is null ? null : lastDrill.Status,
            lastDrill?.StartedAt);
    }
}
