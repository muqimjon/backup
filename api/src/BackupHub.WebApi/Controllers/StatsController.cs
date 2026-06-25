using BackupHub.Application.Features.Dashboard;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackupHub.WebApi.Controllers;

[Authorize]
public sealed class StatsController(ISender mediator) : ApiController(mediator)
{
    [HttpGet]
    public async Task<ActionResult<StatsDto>> Get(CancellationToken ct)
        => Ok(await Mediator.Send(new GetStatsQuery(), ct));
}
