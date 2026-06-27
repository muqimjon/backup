using BackupHub.Application.Abstractions;
using BackupHub.Domain.Entities;
using BackupHub.Domain.Enums;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Application.Features.Agents;

public sealed record RegisterAgentCommand(
    string Name,
    string Hostname,
    string Project,
    string Drivers,
    string Version) : IRequest<Guid>;

internal sealed class RegisterAgentHandler(IAppDbContext db)
    : IRequestHandler<RegisterAgentCommand, Guid>
{
    public async ValueTask<Guid> Handle(RegisterAgentCommand command, CancellationToken ct)
    {
        var agent = await db.Agents
            .FirstOrDefaultAsync(a => a.Hostname == command.Hostname && a.Project == command.Project, ct);

        if (agent is null)
        {
            agent = new Agent
            {
                Name = command.Name,
                Hostname = command.Hostname,
                Project = command.Project,
                Drivers = command.Drivers,
                Version = command.Version,
                TokenHash = string.Empty,
                LastSeenAt = DateTimeOffset.UtcNow,
            };
            db.Agents.Add(agent);
        }
        else
        {
            agent.Name = command.Name;
            agent.Drivers = command.Drivers;
            agent.Version = command.Version;
            agent.LastSeenAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return agent.Id;
    }
}

// One source the agent must back up, with its decrypted secret. Ordered by
// Position so the agent runs databases before object storage (consistency).
public sealed record AgentSourceDto(
    BackupEngine Engine,
    string Host,
    int Port,
    string Username,
    string Secret,
    string Target);

public sealed record AgentJobDto(
    Guid JobId,
    string Name,
    IReadOnlyList<AgentSourceDto> Sources,
    Guid RemoteId,
    RemoteType RemoteType,
    string RemotePath,
    string BackupSchedule,
    string? UploadSchedule,
    string? CleanupSchedule,
    string? DrillSchedule,
    int MinLocalBackups,
    int MaxLocalBackups,
    int MaxRemoteBackups,
    int CompressionLevel,
    string? BackupPassword);

public sealed record GetAgentJobsQuery(Guid AgentId) : IRequest<IReadOnlyList<AgentJobDto>>;

internal sealed class GetAgentJobsHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<GetAgentJobsQuery, IReadOnlyList<AgentJobDto>>
{
    public async ValueTask<IReadOnlyList<AgentJobDto>> Handle(GetAgentJobsQuery query, CancellationToken ct)
    {
        var agentEnabled = await db.Agents
            .Where(a => a.Id == query.AgentId)
            .Select(a => a.Enabled)
            .FirstOrDefaultAsync(ct);
        if (!agentEnabled)
            return [];

        var jobs = await db.Jobs
            .Where(j => j.AgentId == query.AgentId && j.Enabled)
            .Include(j => j.JobSources).ThenInclude(js => js.Source)
            .Include(j => j.Remote)
            .ToListAsync(ct);

        return jobs.Select(j => new AgentJobDto(
            j.Id,
            j.Name,
            j.JobSources
                .OrderBy(js => js.Position)
                .Select(js => new AgentSourceDto(
                    js.Source.Engine,
                    js.Source.Host,
                    js.Source.Port,
                    js.Source.Username,
                    protector.Unprotect(js.Source.SecretEncrypted),
                    js.Source.Target))
                .ToList(),
            j.RemoteId,
            j.Remote.Type,
            j.Remote.Path,
            j.BackupSchedule,
            j.UploadSchedule,
            j.CleanupSchedule,
            j.DrillSchedule,
            j.MinLocalBackups,
            j.MaxLocalBackups,
            j.MaxRemoteBackups,
            j.CompressionLevel,
            j.BackupPasswordEncrypted is null ? null : protector.Unprotect(j.BackupPasswordEncrypted)))
            .ToList();
    }
}

public sealed record AgentCommandDto(Guid Id, CommandKind Kind, Guid? JobId, string? Payload);

public sealed record EnqueueAgentCommandCommand(Guid AgentId, CommandKind Kind, Guid? JobId, string? Payload = null) : IRequest<Guid>;

internal sealed class EnqueueAgentCommandHandler(IAppDbContext db)
    : IRequestHandler<EnqueueAgentCommandCommand, Guid>
{
    public async ValueTask<Guid> Handle(EnqueueAgentCommandCommand command, CancellationToken ct)
    {
        var entity = new AgentCommand
        {
            AgentId = command.AgentId,
            Kind = command.Kind,
            JobId = command.JobId,
            Payload = command.Payload,
        };
        db.Commands.Add(entity);
        await db.SaveChangesAsync(ct);
        return entity.Id;
    }
}

public sealed record GetPendingCommandsQuery(Guid AgentId) : IRequest<IReadOnlyList<AgentCommandDto>>;

internal sealed class GetPendingCommandsHandler(IAppDbContext db)
    : IRequestHandler<GetPendingCommandsQuery, IReadOnlyList<AgentCommandDto>>
{
    public async ValueTask<IReadOnlyList<AgentCommandDto>> Handle(GetPendingCommandsQuery query, CancellationToken ct)
    {
        // The command poll doubles as the agent heartbeat — keep LastSeenAt fresh
        // so "online" reflects a live, polling agent (not just one mid-backup).
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.Id == query.AgentId, ct);
        if (agent is not null)
        {
            agent.LastSeenAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
        }

        return await db.Commands
            .Where(c => c.AgentId == query.AgentId && c.AckedAt == null)
            .OrderBy(c => c.CreatedAt)
            .Select(c => new AgentCommandDto(c.Id, c.Kind, c.JobId, c.Payload))
            .ToListAsync(ct);
    }
}

public sealed record AckCommandCommand(Guid CommandId) : IRequest<bool>;

internal sealed class AckCommandHandler(IAppDbContext db)
    : IRequestHandler<AckCommandCommand, bool>
{
    public async ValueTask<bool> Handle(AckCommandCommand command, CancellationToken ct)
    {
        var entity = await db.Commands.FirstOrDefaultAsync(c => c.Id == command.CommandId, ct);
        if (entity is null)
            return false;

        entity.AckedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return true;
    }
}
