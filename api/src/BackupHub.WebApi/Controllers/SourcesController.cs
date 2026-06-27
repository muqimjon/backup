using BackupHub.Application.Features.Management;
using BackupHub.Application.Features.Sources;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackupHub.WebApi.Controllers;

[Authorize]
public sealed class SourcesController(ISender mediator) : ApiController(mediator)
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SourceDto>>> GetAll(CancellationToken ct)
        => Ok(await Mediator.Send(new GetSourcesQuery(), ct));

    [HttpPost]
    public async Task<ActionResult<Guid>> Create(CreateSourceCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command, ct));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<bool>> Update(Guid id, UpdateSourceCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command with { Id = id }, ct));

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<bool>> Delete(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new DeleteSourceCommand(id), ct));

    // Promote a discovered (pending) source the operator has reviewed; rejecting
    // one is just a Delete above.
    [HttpPost("{id:guid}/confirm")]
    public async Task<ActionResult<bool>> Confirm(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new ConfirmSourceCommand(id), ct));
}
