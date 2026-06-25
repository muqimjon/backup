using BackupHub.Application.Abstractions;
using BackupHub.Domain.Enums;
using Prometheus;

namespace BackupHub.WebApi.Metrics;

public sealed class PrometheusMetricsRecorder : IMetricsRecorder
{
    private static readonly string[] Labels = ["project", "driver"];

    private static readonly Gauge LastSuccess = Prometheus.Metrics.CreateGauge(
        "backuphub_last_success_timestamp", "Unix time of the last successful run.", Labels);

    private static readonly Gauge BackupBytes = Prometheus.Metrics.CreateGauge(
        "backuphub_backup_bytes", "Size in bytes of the last backup.", Labels);

    private static readonly Gauge RunDuration = Prometheus.Metrics.CreateGauge(
        "backuphub_run_duration_seconds", "Duration in seconds of the last run.", Labels);

    private static readonly Counter Failures = Prometheus.Metrics.CreateCounter(
        "backuphub_run_failures_total", "Total number of failed runs.", Labels);

    private static readonly Gauge DrillStatus = Prometheus.Metrics.CreateGauge(
        "backuphub_drill_last_status", "Last restore-drill result (1 ok, 0 fail).", Labels);

    public void RecordRun(string project, string driver, RunType type, RunStatus status, long bytes, double durationSeconds)
    {
        var labels = new[] { project, driver };

        if (durationSeconds > 0)
            RunDuration.WithLabels(labels).Set(durationSeconds);

        if (status == RunStatus.Fail)
            Failures.WithLabels(labels).Inc();

        if (status == RunStatus.Ok)
        {
            LastSuccess.WithLabels(labels).SetToCurrentTimeUtc();
            if (type == RunType.Backup && bytes > 0)
                BackupBytes.WithLabels(labels).Set(bytes);
        }

        if (type == RunType.Drill && status != RunStatus.Running)
            DrillStatus.WithLabels(labels).Set(status == RunStatus.Ok ? 1 : 0);
    }
}
