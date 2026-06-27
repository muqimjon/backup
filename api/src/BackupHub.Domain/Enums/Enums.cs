namespace BackupHub.Domain.Enums;

public enum BackupEngine
{
    Postgres = 0,
    MySql = 1,
    Mssql = 2,
    Minio = 3,
}

public enum RemoteType
{
    GoogleDrive = 0,
    S3 = 1,
    Custom = 2,
    B2 = 3,
    Sftp = 4,
    WebDav = 5,
    OneDrive = 6,
    Dropbox = 7,
    Yandex = 8,
}

public enum RunType
{
    Backup = 0,
    Upload = 1,
    Cleanup = 2,
    Drill = 3,
    Restore = 4,
    Test = 5,
}

public enum RunStatus
{
    Running = 0,
    Ok = 1,
    Fail = 2,
}

public enum CommandKind
{
    RunBackup = 0,
    RunDrill = 1,
    RepullConfig = 2,
    RestoreVersion = 3,
    TestConnection = 4,
    DeliverArtifact = 5,
    TestSource = 6,
    TestRemote = 7,
    DiscoverSources = 8,
    DeleteArtifact = 9,
    ResetAgent = 10,
}

public enum DrillStatus
{
    // Never restore-tested, or its drill status was lost when the file changed.
    Untested = 0,
    // A drill restored it into a scratch DB and found real data — proven restorable.
    Verified = 1,
    // A drill ran but the restore failed or produced no tables — do not trust it.
    Failed = 2,
}

public enum ArtifactLocation
{
    Local = 0,
    Remote = 1,
    Both = 2,
}

public enum SourceOrigin
{
    Manual = 0,
    Discovered = 1,
    // Pushed up by an agent from its local docker-compose config (already configured
    // and trusted) — created Confirmed=true, unlike Discovered which awaits review.
    Adopted = 2,
}

public enum SourceVisibility
{
    // Private → only the discovering (co-located) agent can reach it.
    // Public  → reachable over a published host port, so other agents may use it too.
    Private = 0,
    Public = 1,
}
