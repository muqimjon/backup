using BackupHub.Application.Features.Backups;
using BackupHub.WebApi.Auth;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackupHub.WebApi.Controllers;

public sealed record RestoreRequest(string FileName, bool SnapshotFirst);
public sealed record InventoryRequest(Guid AgentId, Guid JobId, IReadOnlyList<InventoryItem> Items);

public sealed class BackupsController(ISender mediator) : ApiController(mediator)
{
    [Authorize]
    [HttpGet("/api/jobs/{jobId:guid}/versions")]
    public async Task<ActionResult<IReadOnlyList<BackupVersionDto>>> Versions(Guid jobId, CancellationToken ct)
        => Ok(await Mediator.Send(new GetBackupVersionsQuery(jobId), ct));

    [Authorize]
    [HttpPost("/api/jobs/{jobId:guid}/restore")]
    public async Task<ActionResult<Guid>> Restore(Guid jobId, RestoreRequest body, CancellationToken ct)
        => Ok(await Mediator.Send(new RestoreVersionCommand(jobId, body.FileName, body.SnapshotFirst), ct));

    [AgentAuth]
    [HttpPost("/api/agents/inventory")]
    public async Task<ActionResult<int>> Inventory(InventoryRequest body, CancellationToken ct)
        => Ok(await Mediator.Send(new RecordInventoryCommand(body.AgentId, body.JobId, body.Items), ct));
}
