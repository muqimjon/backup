using BackupHub.Application.Features.Agents;
using BackupHub.Application.Features.Sources;
using BackupHub.Domain.Enums;
using BackupHub.WebApi.Auth;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackupHub.WebApi.Controllers;

public sealed record EnqueueRequest(CommandKind Kind, Guid? JobId, string? Payload);

public sealed class AgentsController(ISender mediator) : ApiController(mediator)
{
    [Authorize]
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AgentSummaryDto>>> GetAll(CancellationToken ct)
        => Ok(await Mediator.Send(new GetAgentsQuery(), ct));

    [AgentAuth]
    [HttpPost("register")]
    public async Task<ActionResult<Guid>> Register(RegisterAgentCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command, ct));

    [AgentAuth]
    [HttpGet("{id:guid}/jobs")]
    public async Task<ActionResult<IReadOnlyList<AgentJobDto>>> Jobs(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new GetAgentJobsQuery(id), ct));

    [AgentAuth]
    [HttpGet("{id:guid}/commands")]
    public async Task<ActionResult<IReadOnlyList<AgentCommandDto>>> Commands(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new GetPendingCommandsQuery(id), ct));

    [AgentAuth]
    [HttpGet("source/{id:guid}/conninfo")]
    public async Task<ActionResult<SourceConnInfoDto>> SourceConnInfo(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new GetSourceConnInfoQuery(id), ct));

    [AgentAuth]
    [HttpPost("commands/{commandId:guid}/ack")]
    public async Task<ActionResult<bool>> Ack(Guid commandId, CancellationToken ct)
        => Ok(await Mediator.Send(new AckCommandCommand(commandId), ct));

    [AgentAuth]
    [HttpPost("{id:guid}/discovered-sources")]
    public async Task<ActionResult<int>> ReportDiscoveredSources(
        Guid id, [FromBody] IReadOnlyList<DiscoveredSourceItem> items, CancellationToken ct)
        => Ok(await Mediator.Send(new ReportDiscoveredSourcesCommand(id, items), ct));

    [AgentAuth]
    [HttpPost("{id:guid}/adopt-job")]
    public async Task<ActionResult<Guid>> AdoptJob(Guid id, AdoptJobCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command with { AgentId = id }, ct));

    [Authorize]
    [HttpPost("{id:guid}/enqueue")]
    public async Task<ActionResult<Guid>> Enqueue(Guid id, EnqueueRequest body, CancellationToken ct)
        => Ok(await Mediator.Send(new EnqueueAgentCommandCommand(id, body.Kind, body.JobId, body.Payload), ct));

    [Authorize]
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<bool>> Delete(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new Application.Features.Management.DeleteAgentCommand(id), ct));

    [Authorize]
    [HttpPut("{id:guid}/enabled")]
    public async Task<ActionResult<bool>> SetEnabled(Guid id, [FromBody] bool enabled, CancellationToken ct)
        => Ok(await Mediator.Send(new SetAgentEnabledCommand(id, enabled), ct));
}
