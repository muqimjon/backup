using BackupHub.Application.Abstractions;
using BackupHub.Application.Common;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Application.Features.Management;

public sealed record DeleteSourceCommand(Guid Id) : IRequest<bool>;

internal sealed class DeleteSourceHandler(IAppDbContext db)
    : IRequestHandler<DeleteSourceCommand, bool>
{
    public async ValueTask<bool> Handle(DeleteSourceCommand command, CancellationToken ct)
    {
        if (await db.Jobs.AnyAsync(j => j.SourceId == command.Id, ct))
            throw new ConflictException("This source is used by a job — delete the job first.");

        var source = await db.Sources.FirstOrDefaultAsync(s => s.Id == command.Id, ct);
        if (source is null)
            return false;

        db.Sources.Remove(source);
        await db.SaveChangesAsync(ct);
        return true;
    }
}

public sealed record DeleteRemoteCommand(Guid Id) : IRequest<bool>;

internal sealed class DeleteRemoteHandler(IAppDbContext db)
    : IRequestHandler<DeleteRemoteCommand, bool>
{
    public async ValueTask<bool> Handle(DeleteRemoteCommand command, CancellationToken ct)
    {
        if (await db.Jobs.AnyAsync(j => j.RemoteId == command.Id, ct))
            throw new ConflictException("This destination is used by a job — delete the job first.");

        var remote = await db.Remotes.FirstOrDefaultAsync(r => r.Id == command.Id, ct);
        if (remote is null)
            return false;

        db.Remotes.Remove(remote);
        await db.SaveChangesAsync(ct);
        return true;
    }
}

public sealed record DeleteAgentCommand(Guid Id) : IRequest<bool>;

internal sealed class DeleteAgentHandler(IAppDbContext db)
    : IRequestHandler<DeleteAgentCommand, bool>
{
    public async ValueTask<bool> Handle(DeleteAgentCommand command, CancellationToken ct)
    {
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.Id == command.Id, ct);
        if (agent is null)
            return false;

        var jobs = await db.Jobs.Where(j => j.AgentId == command.Id).ToListAsync(ct);
        foreach (var job in jobs)
            job.AgentId = null;

        var commands = await db.Commands.Where(c => c.AgentId == command.Id).ToListAsync(ct);
        db.Commands.RemoveRange(commands);

        db.Agents.Remove(agent);
        await db.SaveChangesAsync(ct);
        return true;
    }
}
