using BackupHub.Application.Abstractions;
using Mediator;

namespace BackupHub.Application.Features.Ingest;

// An agent reports the outcome of an ad-hoc source/remote connectivity test.
// Nothing is persisted — it is pushed straight to the UI as a toast.
public sealed record RecordTestResultCommand(
    string Target,
    Guid TargetId,
    bool Ok,
    string? Message) : IRequest<bool>;

internal sealed class RecordTestResultHandler(IRunNotifier notifier)
    : IRequestHandler<RecordTestResultCommand, bool>
{
    public async ValueTask<bool> Handle(RecordTestResultCommand command, CancellationToken ct)
    {
        await notifier.PublishTest(
            new TestResultBroadcast(command.Target, command.TargetId, command.Ok, command.Message ?? ""), ct);
        return true;
    }
}
