using BackupHub.Application.Features.History;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackupHub.WebApi.Controllers;

[Authorize]
public sealed class HistoryController(ISender mediator) : ApiController(mediator)
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RunDto>>> GetRecent([FromQuery] int take = 100, CancellationToken ct = default)
        => Ok(await Mediator.Send(new GetRecentRunsQuery(take), ct));
}
