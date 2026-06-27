using BackupHub.Domain.Enums;

namespace BackupHub.Application.Abstractions;

public interface IMetricsRecorder
{
    void RecordRun(string project, string driver, RunType type, RunStatus status, long bytes, double durationSeconds);
}

public sealed record RunBroadcast(
    Guid Id,
    Guid JobId,
    string JobName,
    string Project,
    string Driver,
    RunType Type,
    RunStatus Status,
    DateTimeOffset StartedAt,
    DateTimeOffset? FinishedAt,
    long Bytes,
    string? Message);

// Ad-hoc connectivity test result for one source/remote, pushed to the UI as a
// toast. Not persisted — "source" | "remote" + the element id + ok/message.
public sealed record TestResultBroadcast(string Target, Guid TargetId, bool Ok, string Message);

public interface IRunNotifier
{
    Task Publish(RunBroadcast run, CancellationToken ct = default);
    Task PublishTest(TestResultBroadcast result, CancellationToken ct = default);
}
