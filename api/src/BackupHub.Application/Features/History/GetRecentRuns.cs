using BackupHub.Application.Abstractions;
using BackupHub.Domain.Enums;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Application.Features.History;

public sealed record RunDto(
    Guid Id,
    Guid JobId,
    string JobName,
    RunType Type,
    RunStatus Status,
    DateTimeOffset StartedAt,
    DateTimeOffset? FinishedAt,
    long Bytes,
    string? Message);

public sealed record GetRecentRunsQuery(int Take = 100) : IRequest<IReadOnlyList<RunDto>>;

internal sealed class GetRecentRunsHandler(IAppDbContext db)
    : IRequestHandler<GetRecentRunsQuery, IReadOnlyList<RunDto>>
{
    public async ValueTask<IReadOnlyList<RunDto>> Handle(GetRecentRunsQuery query, CancellationToken ct)
        => await db.Runs
            .OrderByDescending(r => r.StartedAt)
            .Take(Math.Clamp(query.Take, 1, 500))
            .Select(r => new RunDto(
                r.Id, r.JobId, r.Job.Name, r.Type, r.Status,
                r.StartedAt, r.FinishedAt, r.Bytes, r.Message))
            .ToListAsync(ct);
}
