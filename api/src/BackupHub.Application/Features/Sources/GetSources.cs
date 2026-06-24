using BackupHub.Application.Abstractions;
using BackupHub.Domain.Enums;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Application.Features.Sources;

public sealed record SourceDto(
    Guid Id,
    string Name,
    BackupEngine Engine,
    string Host,
    int Port,
    string Username,
    string Target);

public sealed record GetSourcesQuery : IRequest<IReadOnlyList<SourceDto>>;

internal sealed class GetSourcesHandler(IAppDbContext db)
    : IRequestHandler<GetSourcesQuery, IReadOnlyList<SourceDto>>
{
    public async ValueTask<IReadOnlyList<SourceDto>> Handle(GetSourcesQuery query, CancellationToken ct)
        => await db.Sources
            .OrderBy(s => s.Name)
            .Select(s => new SourceDto(s.Id, s.Name, s.Engine, s.Host, s.Port, s.Username, s.Target))
            .ToListAsync(ct);
}
