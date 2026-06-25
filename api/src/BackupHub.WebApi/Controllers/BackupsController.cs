using BackupHub.Application.Features.Backups;
using BackupHub.WebApi.Auth;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackupHub.WebApi.Controllers;

public sealed record RestoreRequest(string FileName, bool SnapshotFirst);
public sealed record DeliverRequest(string FileName);
public sealed record InventoryRequest(Guid AgentId, Guid JobId, IReadOnlyList<InventoryItem> Items);

public sealed class BackupsController(ISender mediator) : ApiController(mediator)
{
    private static string Dir => Path.Combine(Path.GetTempPath(), "backuphub-dl");

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

    // ── Download: ask the agent to deliver a file, then stream it to the browser ──

    [Authorize]
    [HttpPost("/api/jobs/{jobId:guid}/deliver")]
    public async Task<ActionResult<Guid>> Deliver(Guid jobId, DeliverRequest body, CancellationToken ct)
        => Ok(await Mediator.Send(new DeliverArtifactCommand(jobId, body.FileName), ct));

    [AgentAuth]
    [HttpPost("/api/agents/artifact-upload")]
    [RequestSizeLimit(2_000_000_000)]
    public async Task<IActionResult> Upload([FromForm] Guid jobId, [FromForm] string fileName, IFormFile file, CancellationToken ct)
    {
        var dir = Path.Combine(Dir, jobId.ToString());
        Directory.CreateDirectory(dir);
        var path = Path.Combine(dir, Path.GetFileName(fileName));
        await using var fs = System.IO.File.Create(path);
        await file.CopyToAsync(fs, ct);
        return Ok();
    }

    [Authorize]
    [HttpGet("/api/jobs/{jobId:guid}/download")]
    public IActionResult Download(Guid jobId, [FromQuery] string file)
    {
        var path = Path.Combine(Dir, jobId.ToString(), Path.GetFileName(file));
        if (!System.IO.File.Exists(path))
            return NotFound();

        var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 8192, FileOptions.DeleteOnClose);
        return File(stream, "application/zip", Path.GetFileName(file));
    }
}
