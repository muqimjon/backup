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
}
