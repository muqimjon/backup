using BackupHub.Application.Abstractions;
using BackupHub.Domain.Entities;
using BackupHub.Domain.Enums;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Application.Features.Sources;

public sealed record DiscoveredSourceItem(
    BackupEngine Engine,
    string Host,
    int Port,
    string Username,
    string Secret,
    string Target,
    SourceVisibility Visibility,
    string? Name);

public sealed record ReportDiscoveredSourcesCommand(Guid AgentId, IReadOnlyList<DiscoveredSourceItem> Items)
    : IRequest<int>;

// Agent-only. Upserts the sources an agent found next to itself. Dedup key is
// (agent, engine, host, target) so re-scans update in place instead of piling
// up. We never touch a source the user has already Confirmed — discovery only
// seeds the review queue; the operator stays in control.
internal sealed class ReportDiscoveredSourcesHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<ReportDiscoveredSourcesCommand, int>
{
    public async ValueTask<int> Handle(ReportDiscoveredSourcesCommand command, CancellationToken ct)
    {
        var existing = await db.Sources
            .Where(s => s.DiscoveredByAgentId == command.AgentId)
            .ToListAsync(ct);

        // Discovered sources are parked in a per-agent project named after it, so
        // every source still belongs to a project; the operator can reorganise later.
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.Id == command.AgentId, ct);
        var projectName = string.IsNullOrWhiteSpace(agent?.Project) ? "Discovered" : agent!.Project;
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Name == projectName, ct);
        if (project is null)
        {
            project = new Project { Name = projectName };
            db.Projects.Add(project);
        }

        var changed = 0;
        foreach (var item in command.Items)
        {
            var match = existing.FirstOrDefault(s =>
                s.Engine == item.Engine && s.Host == item.Host && s.Target == item.Target);

            if (match is null)
            {
                db.Sources.Add(new Source
                {
                    Name = string.IsNullOrWhiteSpace(item.Name) ? $"{item.Host}/{item.Target}" : item.Name!,
                    Project = project,
                    Engine = item.Engine,
                    Host = item.Host,
                    Port = item.Port,
                    Username = item.Username,
                    SecretEncrypted = protector.Protect(item.Secret),
                    Target = item.Target,
                    Origin = SourceOrigin.Discovered,
                    Confirmed = false,
                    Visibility = item.Visibility,
                    DiscoveredByAgentId = command.AgentId,
                });
                changed++;
            }
            else if (!match.Confirmed)
            {
                // Refresh the still-pending entry (creds/port/visibility may change).
                match.Port = item.Port;
                match.Username = item.Username;
                match.Visibility = item.Visibility;
                if (!string.IsNullOrEmpty(item.Secret))
                    match.SecretEncrypted = protector.Protect(item.Secret);
                changed++;
            }
        }

        await db.SaveChangesAsync(ct);
        return changed;
    }
}
