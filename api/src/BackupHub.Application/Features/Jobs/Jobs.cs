using BackupHub.Application.Abstractions;
using BackupHub.Application.Common;
using BackupHub.Domain.Entities;
using FluentValidation;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Application.Features.Jobs;

public sealed record JobDto(
    Guid Id,
    string Name,
    bool Enabled,
    Guid SourceId,
    string SourceName,
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
        => await db.Jobs
            .OrderBy(j => j.Name)
            .Select(j => new JobDto(
                j.Id, j.Name, j.Enabled,
                j.SourceId, j.Source.Name,
                j.RemoteId, j.Remote.Name,
                j.AgentId,
                j.BackupSchedule, j.UploadSchedule, j.CleanupSchedule, j.DrillSchedule,
                j.MinLocalBackups, j.MaxLocalBackups, j.MaxRemoteBackups, j.CompressionLevel))
            .ToListAsync(ct);
}

public sealed record CreateJobCommand(
    string Name,
    Guid SourceId,
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
        RuleFor(x => x.SourceId).NotEmpty();
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
        if (!await db.Sources.AnyAsync(s => s.Id == command.SourceId, ct))
            throw new NotFoundException("Source not found");
        if (!await db.Remotes.AnyAsync(r => r.Id == command.RemoteId, ct))
            throw new NotFoundException("Remote not found");

        var job = new BackupJob
        {
            Name = command.Name,
            SourceId = command.SourceId,
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
