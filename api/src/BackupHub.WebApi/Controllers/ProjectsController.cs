using BackupHub.Application.Features.Projects;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackupHub.WebApi.Controllers;

[Authorize]
public sealed class ProjectsController(ISender mediator) : ApiController(mediator)
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProjectDto>>> GetAll(CancellationToken ct)
        => Ok(await Mediator.Send(new GetProjectsQuery(), ct));

    [HttpPost]
    public async Task<ActionResult<Guid>> Create(CreateProjectCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command, ct));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<bool>> Update(Guid id, UpdateProjectCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command with { Id = id }, ct));

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<bool>> Delete(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new DeleteProjectCommand(id), ct));
}
