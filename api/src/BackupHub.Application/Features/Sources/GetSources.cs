using BackupHub.Application.Abstractions;
using BackupHub.Application.Common;
using BackupHub.Domain.Enums;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Application.Features.Sources;

public sealed record SourceDto(
    Guid Id,
    string Name,
    Guid ProjectId,
    BackupEngine Engine,
    string Host,
    int Port,
    string Username,
    string Target,
    SourceOrigin Origin,
    bool Confirmed,
    SourceVisibility Visibility,
    Guid? DiscoveredByAgentId);

public sealed record GetSourcesQuery : IRequest<IReadOnlyList<SourceDto>>;

internal sealed class GetSourcesHandler(IAppDbContext db)
    : IRequestHandler<GetSourcesQuery, IReadOnlyList<SourceDto>>
{
    public async ValueTask<IReadOnlyList<SourceDto>> Handle(GetSourcesQuery query, CancellationToken ct)
        => await db.Sources
            .OrderBy(s => s.Name)
            .Select(s => new SourceDto(s.Id, s.Name, s.ProjectId, s.Engine, s.Host, s.Port, s.Username, s.Target,
                s.Origin, s.Confirmed, s.Visibility, s.DiscoveredByAgentId))
            .ToListAsync(ct);
}

// Promote a discovered (pending) source into a confirmed one the operator trusts.
public sealed record ConfirmSourceCommand(Guid Id) : IRequest<bool>;

internal sealed class ConfirmSourceHandler(IAppDbContext db)
    : IRequestHandler<ConfirmSourceCommand, bool>
{
    public async ValueTask<bool> Handle(ConfirmSourceCommand command, CancellationToken ct)
    {
        var s = await db.Sources.FirstOrDefaultAsync(x => x.Id == command.Id, ct)
            ?? throw new NotFoundException("Source not found");
        // Keep Origin/Visibility/DiscoveredByAgentId — the job UI still needs them
        // to decide which agents may run a private vs public source.
        s.Confirmed = true;
        await db.SaveChangesAsync(ct);
        return true;
    }
}

// Agent-only: full connection details (incl. decrypted secret) so the agent can
// run a connectivity test. Same trust level as the remote rclone-conf endpoint.
public sealed record SourceConnInfoDto(
    BackupEngine Engine, string Host, int Port, string Username, string Secret, string Target);

public sealed record GetSourceConnInfoQuery(Guid Id) : IRequest<SourceConnInfoDto>;

internal sealed class GetSourceConnInfoHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<GetSourceConnInfoQuery, SourceConnInfoDto>
{
    public async ValueTask<SourceConnInfoDto> Handle(GetSourceConnInfoQuery query, CancellationToken ct)
    {
        var s = await db.Sources.FirstOrDefaultAsync(x => x.Id == query.Id, ct)
            ?? throw new NotFoundException("Source not found");
        return new SourceConnInfoDto(s.Engine, s.Host, s.Port, s.Username, protector.Unprotect(s.SecretEncrypted), s.Target);
    }
}
