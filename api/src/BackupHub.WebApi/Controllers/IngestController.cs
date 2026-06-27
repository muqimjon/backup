using BackupHub.Application.Features.Ingest;
using BackupHub.WebApi.Auth;
using Mediator;
using Microsoft.AspNetCore.Mvc;

namespace BackupHub.WebApi.Controllers;

[AgentAuth]
public sealed class IngestController(ISender mediator) : ApiController(mediator)
{
    [HttpPost("events")]
    public async Task<ActionResult<Guid>> Events(RecordRunEventCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command, ct));

    [HttpPost("test-result")]
    public async Task<ActionResult<bool>> TestResult(RecordTestResultCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command, ct));
}
