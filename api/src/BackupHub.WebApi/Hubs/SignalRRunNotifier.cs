using BackupHub.Application.Abstractions;
using Microsoft.AspNetCore.SignalR;

namespace BackupHub.WebApi.Hubs;

public sealed class SignalRRunNotifier(IHubContext<RunsHub> hub) : IRunNotifier
{
    public Task Publish(RunBroadcast run, CancellationToken ct = default)
        => hub.Clients.All.SendAsync("run", run, ct);
}
