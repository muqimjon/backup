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
}

public enum ArtifactLocation
{
    Local = 0,
    Remote = 1,
    Both = 2,
}
