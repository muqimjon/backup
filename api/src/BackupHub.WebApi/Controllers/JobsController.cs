using BackupHub.Application.Features.Jobs;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackupHub.WebApi.Controllers;

[Authorize]
public sealed class JobsController(ISender mediator) : ApiController(mediator)
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<JobDto>>> GetAll(CancellationToken ct)
        => Ok(await Mediator.Send(new GetJobsQuery(), ct));

    [HttpPost]
    public async Task<ActionResult<Guid>> Create(CreateJobCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command, ct));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<bool>> Update(Guid id, UpdateJobCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command with { Id = id }, ct));

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<bool>> Delete(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new DeleteJobCommand(id), ct));
}
