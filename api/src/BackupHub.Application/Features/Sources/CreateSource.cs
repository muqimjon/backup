using BackupHub.Application.Abstractions;
using BackupHub.Application.Common;
using BackupHub.Domain.Entities;
using BackupHub.Domain.Enums;
using FluentValidation;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Application.Features.Sources;

public sealed record CreateSourceCommand(
    Guid ProjectId,
    string Name,
    BackupEngine Engine,
    string Host,
    int Port,
    string Username,
    string Secret,
    string Target) : IRequest<Guid>;

public sealed class CreateSourceValidator : AbstractValidator<CreateSourceCommand>
{
    public CreateSourceValidator()
    {
        RuleFor(x => x.ProjectId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Host).NotEmpty();
        RuleFor(x => x.Port).InclusiveBetween(1, 65535);
        RuleFor(x => x.Username).NotEmpty();
        RuleFor(x => x.Target).NotEmpty();
    }
}

internal sealed class CreateSourceHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<CreateSourceCommand, Guid>
{
    public async ValueTask<Guid> Handle(CreateSourceCommand command, CancellationToken ct)
    {
        if (!await db.Projects.AnyAsync(p => p.Id == command.ProjectId, ct))
            throw new NotFoundException("Project not found");

        var source = new Source
        {
            ProjectId = command.ProjectId,
            Name = command.Name,
            Engine = command.Engine,
            Host = command.Host,
            Port = command.Port,
            Username = command.Username,
            SecretEncrypted = protector.Protect(command.Secret),
            Target = command.Target,
        };

        db.Sources.Add(source);
        await db.SaveChangesAsync(ct);
        return source.Id;
    }
}

public sealed record UpdateSourceCommand(
    Guid Id,
    Guid ProjectId,
    string Name,
    BackupEngine Engine,
    string Host,
    int Port,
    string Username,
    string? Secret,
    string Target) : IRequest<bool>;

public sealed class UpdateSourceValidator : AbstractValidator<UpdateSourceCommand>
{
    public UpdateSourceValidator()
    {
        RuleFor(x => x.ProjectId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Host).NotEmpty();
        RuleFor(x => x.Port).InclusiveBetween(1, 65535);
        RuleFor(x => x.Username).NotEmpty();
        RuleFor(x => x.Target).NotEmpty();
    }
}

internal sealed class UpdateSourceHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<UpdateSourceCommand, bool>
{
    public async ValueTask<bool> Handle(UpdateSourceCommand command, CancellationToken ct)
    {
        var source = await db.Sources.FirstOrDefaultAsync(s => s.Id == command.Id, ct)
            ?? throw new NotFoundException("Source not found");

        // Moving the source to another project? Block it if it's in use by a job —
        // a job's sources must all stay within its project.
        if (command.ProjectId != source.ProjectId
            && await db.JobSources.AnyAsync(js => js.SourceId == command.Id, ct))
            throw new ConflictException("This source is used by a job — remove it from the job before moving it.");
        if (!await db.Projects.AnyAsync(p => p.Id == command.ProjectId, ct))
            throw new NotFoundException("Target project not found");

        source.ProjectId = command.ProjectId;
        source.Name = command.Name;
        source.Engine = command.Engine;
        source.Host = command.Host;
        source.Port = command.Port;
        source.Username = command.Username;
        source.Target = command.Target;
        // Empty secret = keep the existing one (the UI never echoes stored secrets back).
        if (!string.IsNullOrEmpty(command.Secret))
            source.SecretEncrypted = protector.Protect(command.Secret);

        await db.SaveChangesAsync(ct);
        return true;
    }
}
