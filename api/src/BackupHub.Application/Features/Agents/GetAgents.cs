using BackupHub.Application.Abstractions;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Application.Features.Agents;

public sealed record AgentSummaryDto(
    Guid Id,
    string Name,
    string Hostname,
    string Project,
    string Drivers,
    string Version,
    bool Enabled,
    DateTimeOffset? LastSeenAt);

public sealed record GetAgentsQuery : IRequest<IReadOnlyList<AgentSummaryDto>>;

internal sealed class GetAgentsHandler(IAppDbContext db)
    : IRequestHandler<GetAgentsQuery, IReadOnlyList<AgentSummaryDto>>
{
    public async ValueTask<IReadOnlyList<AgentSummaryDto>> Handle(GetAgentsQuery query, CancellationToken ct)
        => await db.Agents
            .OrderBy(a => a.Name)
            .Select(a => new AgentSummaryDto(a.Id, a.Name, a.Hostname, a.Project, a.Drivers, a.Version, a.Enabled, a.LastSeenAt))
            .ToListAsync(ct);
}

public sealed record SetAgentEnabledCommand(Guid Id, bool Enabled) : IRequest<bool>;

internal sealed class SetAgentEnabledHandler(IAppDbContext db)
    : IRequestHandler<SetAgentEnabledCommand, bool>
{
    public async ValueTask<bool> Handle(SetAgentEnabledCommand command, CancellationToken ct)
    {
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.Id == command.Id, ct);
        if (agent is null)
            return false;
        agent.Enabled = command.Enabled;
        await db.SaveChangesAsync(ct);
        return true;
    }
}
