using BackupHub.Application.Abstractions;
using BackupHub.Application.Common;
using BackupHub.Application.Features.Sources;
using BackupHub.Domain.Entities;
using FluentValidation;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Application.Features.Projects;

public sealed record ProjectDto(Guid Id, string Name, IReadOnlyList<SourceDto> Sources);

public sealed record GetProjectsQuery : IRequest<IReadOnlyList<ProjectDto>>;

internal sealed class GetProjectsHandler(IAppDbContext db)
    : IRequestHandler<GetProjectsQuery, IReadOnlyList<ProjectDto>>
{
    public async ValueTask<IReadOnlyList<ProjectDto>> Handle(GetProjectsQuery query, CancellationToken ct)
        => await db.Projects
            .OrderBy(p => p.Name)
            .Select(p => new ProjectDto(p.Id, p.Name,
                p.Sources.OrderBy(s => s.Name).Select(s => new SourceDto(
                    s.Id, s.Name, s.ProjectId, s.Engine, s.Host, s.Port, s.Username, s.Target,
                    s.Origin, s.Confirmed, s.Visibility, s.DiscoveredByAgentId)).ToList()))
            .ToListAsync(ct);
}

public sealed record CreateProjectCommand(string Name) : IRequest<Guid>;

public sealed class CreateProjectValidator : AbstractValidator<CreateProjectCommand>
{
    public CreateProjectValidator() => RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
}

internal sealed class CreateProjectHandler(IAppDbContext db)
    : IRequestHandler<CreateProjectCommand, Guid>
{
    public async ValueTask<Guid> Handle(CreateProjectCommand command, CancellationToken ct)
    {
        var project = new Project { Name = command.Name };
        db.Projects.Add(project);
        await db.SaveChangesAsync(ct);
        return project.Id;
    }
}

public sealed record UpdateProjectCommand(Guid Id, string Name) : IRequest<bool>;

public sealed class UpdateProjectValidator : AbstractValidator<UpdateProjectCommand>
{
    public UpdateProjectValidator() => RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
}

internal sealed class UpdateProjectHandler(IAppDbContext db)
    : IRequestHandler<UpdateProjectCommand, bool>
{
    public async ValueTask<bool> Handle(UpdateProjectCommand command, CancellationToken ct)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == command.Id, ct)
            ?? throw new NotFoundException("Project not found");
        project.Name = command.Name;
        await db.SaveChangesAsync(ct);
        return true;
    }
}

public sealed record DeleteProjectCommand(Guid Id) : IRequest<bool>;

internal sealed class DeleteProjectHandler(IAppDbContext db)
    : IRequestHandler<DeleteProjectCommand, bool>
{
    public async ValueTask<bool> Handle(DeleteProjectCommand command, CancellationToken ct)
    {
        if (await db.Jobs.AnyAsync(j => j.ProjectId == command.Id, ct))
            throw new ConflictException("This project has a backup job — delete the job first.");

        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == command.Id, ct);
        if (project is null)
            return false;

        // Sources cascade-delete with the project (none are in a job — we blocked that).
        db.Projects.Remove(project);
        await db.SaveChangesAsync(ct);
        return true;
    }
}
