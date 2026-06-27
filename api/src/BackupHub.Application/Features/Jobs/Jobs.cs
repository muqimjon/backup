using BackupHub.Application.Abstractions;
using BackupHub.Application.Common;
using BackupHub.Domain.Entities;
using BackupHub.Domain.Enums;
using FluentValidation;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Application.Features.Jobs;

public sealed record JobDto(
    Guid Id,
    string Name,
    bool Enabled,
    Guid ProjectId,
    string ProjectName,
    IReadOnlyList<Guid> SourceIds,
    IReadOnlyList<string> SourceNames,
    Guid RemoteId,
    string RemoteName,
    Guid? AgentId,
    string BackupSchedule,
    string? UploadSchedule,
    string? CleanupSchedule,
    string? DrillSchedule,
    int MinLocalBackups,
    int MaxLocalBackups,
    int MaxRemoteBackups,
    int CompressionLevel);

public sealed record GetJobsQuery : IRequest<IReadOnlyList<JobDto>>;

internal sealed class GetJobsHandler(IAppDbContext db)
    : IRequestHandler<GetJobsQuery, IReadOnlyList<JobDto>>
{
    public async ValueTask<IReadOnlyList<JobDto>> Handle(GetJobsQuery query, CancellationToken ct)
    {
        var jobs = await db.Jobs
            .OrderBy(j => j.Name)
            .Include(j => j.Project)
            .Include(j => j.JobSources).ThenInclude(js => js.Source)
            .Include(j => j.Remote)
            .ToListAsync(ct);

        return jobs.Select(j =>
        {
            var ordered = j.JobSources.OrderBy(js => js.Position).ToList();
            return new JobDto(
                j.Id, j.Name, j.Enabled,
                j.ProjectId, j.Project.Name,
                ordered.Select(js => js.SourceId).ToList(),
                ordered.Select(js => js.Source.Name).ToList(),
                j.RemoteId, j.Remote.Name,
                j.AgentId,
                j.BackupSchedule, j.UploadSchedule, j.CleanupSchedule, j.DrillSchedule,
                j.MinLocalBackups, j.MaxLocalBackups, j.MaxRemoteBackups, j.CompressionLevel);
        }).ToList();
    }
}

// Orders the chosen sources into JobSource rows: databases first, object storage
// (MinIO) last, so the agent's combined run dumps the DB before mirroring objects
// — the DB dump can never reference an object the mirror is missing.
internal static class JobSourceOrdering
{
    public static List<JobSource> Build(IReadOnlyList<Source> sources)
        => sources
            .OrderBy(s => s.Engine == BackupEngine.Minio ? 1 : 0)
            .Select((s, i) => new JobSource { SourceId = s.Id, Position = i })
            .ToList();

    // The agent runs one source per engine in a combined run — its per-engine env
    // vars (PG_*/MYSQL_*/MINIO_*) and the {project}_{driver}_{ts}.zip archive name
    // collide for two sources of the same engine, silently backing up only one.
    // Reject that here so a job can never quietly lose a database.
    public static void EnsureOneSourcePerEngine(IReadOnlyList<Source> sources)
    {
        var dup = sources.GroupBy(s => s.Engine).FirstOrDefault(g => g.Count() > 1);
        if (dup is not null)
            throw new ConflictException(
                $"A job can include at most one {dup.Key} source — the agent backs up one per engine in a combined run. Put same-engine sources in separate jobs.");
    }
}

public sealed record CreateJobCommand(
    string Name,
    Guid ProjectId,
    IReadOnlyList<Guid> SourceIds,
    Guid RemoteId,
    Guid? AgentId,
    string BackupSchedule,
    string? UploadSchedule,
    string? CleanupSchedule,
    string? DrillSchedule,
    int MinLocalBackups,
    int MaxLocalBackups,
    int MaxRemoteBackups,
    int CompressionLevel,
    string? BackupPassword) : IRequest<Guid>;

public sealed class CreateJobValidator : AbstractValidator<CreateJobCommand>
{
    public CreateJobValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.ProjectId).NotEmpty();
        RuleFor(x => x.SourceIds).NotEmpty().WithMessage("Select at least one source");
        RuleFor(x => x.RemoteId).NotEmpty();
        RuleFor(x => x.BackupSchedule).NotEmpty();
        RuleFor(x => x.MinLocalBackups).GreaterThanOrEqualTo(1);
        RuleFor(x => x.MaxLocalBackups).GreaterThanOrEqualTo(x => x.MinLocalBackups);
        RuleFor(x => x.MaxRemoteBackups).GreaterThanOrEqualTo(1);
        RuleFor(x => x.CompressionLevel).InclusiveBetween(1, 9);
    }
}

internal sealed class CreateJobHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<CreateJobCommand, Guid>
{
    public async ValueTask<Guid> Handle(CreateJobCommand command, CancellationToken ct)
    {
        // Sources must belong to the job's project.
        var sources = await db.Sources
            .Where(s => command.SourceIds.Contains(s.Id) && s.ProjectId == command.ProjectId)
            .ToListAsync(ct);
        if (sources.Count != command.SourceIds.Distinct().Count())
            throw new NotFoundException("One or more sources don't belong to this project");
        JobSourceOrdering.EnsureOneSourcePerEngine(sources);
        if (!await db.Remotes.AnyAsync(r => r.Id == command.RemoteId, ct))
            throw new NotFoundException("Remote not found");

        var job = new BackupJob
        {
            Name = command.Name,
            ProjectId = command.ProjectId,
            JobSources = JobSourceOrdering.Build(sources),
            RemoteId = command.RemoteId,
            AgentId = command.AgentId,
            BackupSchedule = command.BackupSchedule,
            UploadSchedule = command.UploadSchedule,
            CleanupSchedule = command.CleanupSchedule,
            DrillSchedule = command.DrillSchedule,
            MinLocalBackups = command.MinLocalBackups,
            MaxLocalBackups = command.MaxLocalBackups,
            MaxRemoteBackups = command.MaxRemoteBackups,
            CompressionLevel = command.CompressionLevel,
            BackupPasswordEncrypted = string.IsNullOrEmpty(command.BackupPassword)
                ? null
                : protector.Protect(command.BackupPassword),
        };

        db.Jobs.Add(job);
        await db.SaveChangesAsync(ct);
        return job.Id;
    }
}

public sealed record UpdateJobCommand(
    Guid Id,
    string Name,
    bool Enabled,
    Guid ProjectId,
    IReadOnlyList<Guid> SourceIds,
    Guid RemoteId,
    Guid? AgentId,
    string BackupSchedule,
    string? UploadSchedule,
    string? CleanupSchedule,
    string? DrillSchedule,
    int MinLocalBackups,
    int MaxLocalBackups,
    int MaxRemoteBackups,
    int CompressionLevel,
    string? BackupPassword) : IRequest<bool>;

public sealed class UpdateJobValidator : AbstractValidator<UpdateJobCommand>
{
    public UpdateJobValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.ProjectId).NotEmpty();
        RuleFor(x => x.SourceIds).NotEmpty().WithMessage("Select at least one source");
        RuleFor(x => x.RemoteId).NotEmpty();
        RuleFor(x => x.BackupSchedule).NotEmpty();
        RuleFor(x => x.MinLocalBackups).GreaterThanOrEqualTo(1);
        RuleFor(x => x.MaxLocalBackups).GreaterThanOrEqualTo(x => x.MinLocalBackups);
        RuleFor(x => x.MaxRemoteBackups).GreaterThanOrEqualTo(1);
        RuleFor(x => x.CompressionLevel).InclusiveBetween(1, 9);
    }
}

internal sealed class UpdateJobHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<UpdateJobCommand, bool>
{
    public async ValueTask<bool> Handle(UpdateJobCommand command, CancellationToken ct)
    {
        var job = await db.Jobs
            .Include(j => j.JobSources)
            .FirstOrDefaultAsync(j => j.Id == command.Id, ct)
            ?? throw new NotFoundException("Job not found");

        var sources = await db.Sources
            .Where(s => command.SourceIds.Contains(s.Id) && s.ProjectId == command.ProjectId)
            .ToListAsync(ct);
        if (sources.Count != command.SourceIds.Distinct().Count())
            throw new NotFoundException("One or more sources don't belong to this project");
        JobSourceOrdering.EnsureOneSourcePerEngine(sources);

        job.Name = command.Name;
        job.Enabled = command.Enabled;
        job.ProjectId = command.ProjectId;
        // Replace the source links: delete the old rows, then add the new ones
        // straight to the DbSet with an explicit JobId. Adding to the tracked
        // parent's navigation lets EF mis-detect these client-keyed rows as updates
        // and fail with a 0-rows concurrency error.
        db.JobSources.RemoveRange(job.JobSources);
        foreach (var js in JobSourceOrdering.Build(sources))
        {
            js.JobId = job.Id;
            db.JobSources.Add(js);
        }
        job.RemoteId = command.RemoteId;
        job.AgentId = command.AgentId;
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

        await db.SaveChangesAsync(ct);
        return true;
    }
}

public sealed record DeleteJobCommand(Guid Id) : IRequest<bool>;

internal sealed class DeleteJobHandler(IAppDbContext db)
    : IRequestHandler<DeleteJobCommand, bool>
{
    public async ValueTask<bool> Handle(DeleteJobCommand command, CancellationToken ct)
    {
        var job = await db.Jobs.FirstOrDefaultAsync(j => j.Id == command.Id, ct);
        if (job is null)
            return false;

        var artifacts = await db.Artifacts.Where(a => a.JobId == command.Id).ToListAsync(ct);
        db.Artifacts.RemoveRange(artifacts);
        var commands = await db.Commands.Where(c => c.JobId == command.Id).ToListAsync(ct);
        db.Commands.RemoveRange(commands);

        db.Jobs.Remove(job);
        await db.SaveChangesAsync(ct);
        return true;
    }
}
