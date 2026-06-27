using BackupHub.Application.Abstractions;
using BackupHub.Application.Common;
using BackupHub.Application.Features.Jobs;
using BackupHub.Domain.Entities;
using BackupHub.Domain.Enums;
using FluentValidation;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Application.Features.Agents;

// One source from the agent's local docker-compose config.
public sealed record AdoptSourceItem(
    BackupEngine Engine,
    string Host,
    int Port,
    string Username,
    string Secret,
    string Target);

// An agent pushing its locally-configured backup ("project") up to the hub so it
// appears in the UI and becomes hub-managed. Idempotent: re-sending updates the
// same job/sources/remote in place (dedup by agent + name).
public sealed record AdoptJobCommand(
    Guid AgentId,
    string Name,
    string BackupSchedule,
    string? UploadSchedule,
    string? CleanupSchedule,
    string? DrillSchedule,
    int MinLocalBackups,
    int MaxLocalBackups,
    int MaxRemoteBackups,
    int CompressionLevel,
    string? BackupPassword,
    IReadOnlyList<AdoptSourceItem> Sources,
    string RemoteName,
    string RemotePath,
    string RcloneConfig) : IRequest<Guid>;

public sealed class AdoptJobValidator : AbstractValidator<AdoptJobCommand>
{
    public AdoptJobValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Sources).NotEmpty();
        RuleFor(x => x.RemoteName).NotEmpty();
        RuleFor(x => x.RcloneConfig).NotEmpty();
        RuleFor(x => x.BackupSchedule).NotEmpty();
        RuleFor(x => x.CompressionLevel).InclusiveBetween(1, 9);
    }
}

internal sealed class AdoptJobHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<AdoptJobCommand, Guid>
{
    public async ValueTask<Guid> Handle(AdoptJobCommand command, CancellationToken ct)
    {
        if (!await db.Agents.AnyAsync(a => a.Id == command.AgentId, ct))
            throw new NotFoundException("Agent not found");

        var project = await UpsertProject(command, ct);
        var remote = await UpsertRemote(command, ct);
        var sources = await UpsertSources(command, project, ct);
        var jobId = await UpsertJob(command, project, remote, sources, ct);

        await db.SaveChangesAsync(ct);
        return jobId;
    }

    // The adopted backup maps to a project named after it; sources go inside it.
    private async ValueTask<Project> UpsertProject(AdoptJobCommand command, CancellationToken ct)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Name == command.Name, ct);
        if (project is null)
        {
            project = new Project { Name = command.Name };
            db.Projects.Add(project);
        }
        return project;
    }

    // Store the agent's own rclone.conf verbatim as a Custom remote (the factory's
    // BuildCustom re-homes it under [remote], which is what the agent fetches back).
    private async ValueTask<Remote> UpsertRemote(AdoptJobCommand command, CancellationToken ct)
    {
        var remote = await db.Remotes.FirstOrDefaultAsync(r => r.Name == command.RemoteName, ct);
        if (remote is null)
        {
            remote = new Remote { Name = command.RemoteName, Type = RemoteType.Custom };
            db.Remotes.Add(remote);
        }
        remote.Type = RemoteType.Custom;
        remote.Path = command.RemotePath;
        remote.ConfigEncrypted = protector.Protect(command.RcloneConfig);
        return remote;
    }

    // Upsert each source by (agent, engine, host, target) — same dedup key as
    // discovery — but mark Adopted + Confirmed (already configured, no review needed).
    private async ValueTask<List<Source>> UpsertSources(AdoptJobCommand command, Project project, CancellationToken ct)
    {
        var existing = await db.Sources
            .Where(s => s.DiscoveredByAgentId == command.AgentId)
            .ToListAsync(ct);

        var result = new List<Source>();
        foreach (var item in command.Sources)
        {
            var source = existing.FirstOrDefault(s =>
                s.Engine == item.Engine && s.Host == item.Host && s.Target == item.Target);

            if (source is null)
            {
                source = new Source
                {
                    Name = $"{DriverShort(item.Engine)}",
                    Engine = item.Engine,
                    DiscoveredByAgentId = command.AgentId,
                    Project = project,
                };
                db.Sources.Add(source);
                existing.Add(source);
            }
            source.Project = project;

            source.Host = item.Host;
            source.Port = item.Port;
            source.Username = item.Username;
            source.Target = item.Target;
            if (!string.IsNullOrEmpty(item.Secret))
                source.SecretEncrypted = protector.Protect(item.Secret);
            source.Origin = SourceOrigin.Adopted;
            source.Confirmed = true;
            result.Add(source);
        }
        return result;
    }

    private async ValueTask<Guid> UpsertJob(
        AdoptJobCommand command, Project project, Remote remote, List<Source> sources, CancellationToken ct)
    {
        var job = await db.Jobs
            .Include(j => j.JobSources)
            .FirstOrDefaultAsync(j => j.AgentId == command.AgentId && j.Name == command.Name, ct);

        if (job is null)
        {
            job = new BackupJob { Name = command.Name, AgentId = command.AgentId, Project = project };
            db.Jobs.Add(job);
        }
        else
        {
            job.Project = project;
            db.JobSources.RemoveRange(job.JobSources);
        }

        // Add the new links straight to the DbSet (forces INSERT) with an explicit
        // JobId — adding to the tracked parent's navigation would let EF mis-detect
        // these client-keyed rows as updates and fail with a 0-rows concurrency error.
        foreach (var js in JobSourceOrdering.Build(sources))
        {
            js.JobId = job.Id;
            db.JobSources.Add(js);
        }
        job.Remote = remote;
        job.BackupSchedule = command.BackupSchedule;
        job.UploadSchedule = command.UploadSchedule;
        job.CleanupSchedule = command.CleanupSchedule;
        job.DrillSchedule = command.DrillSchedule;
        job.MinLocalBackups = command.MinLocalBackups;
        job.MaxLocalBackups = command.MaxLocalBackups;
        job.MaxRemoteBackups = command.MaxRemoteBackups;
        job.CompressionLevel = command.CompressionLevel;
        if (!string.IsNullOrEmpty(command.BackupPassword))
            job.BackupPasswordEncrypted = protector.Protect(command.BackupPassword);

        return job.Id;
    }

    private static string DriverShort(BackupEngine engine) => engine switch
    {
        BackupEngine.Postgres => "PostgreSQL",
        BackupEngine.MySql => "MySQL",
        BackupEngine.Mssql => "MSSQL",
        BackupEngine.Minio => "MinIO",
        _ => "source",
    };
}
