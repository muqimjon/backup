using System.Text.Json;
using BackupHub.Application.Abstractions;
using BackupHub.Domain.Entities;
using BackupHub.Domain.Enums;

namespace BackupHub.Infrastructure.Rclone;

public sealed class RcloneConfigFactory(ISecretProtector protector) : IRcloneConfigFactory
{
    public string Build(Remote remote)
    {
        var data = protector.Unprotect(remote.ConfigEncrypted);

        return remote.Type switch
        {
            RemoteType.GoogleDrive =>
                $"[remote]\ntype = drive\nscope = drive\ntoken = {data}\n",
            RemoteType.S3 => BuildS3(data),
            RemoteType.B2 => BuildB2(data),
            RemoteType.Sftp => BuildSftp(data),
            RemoteType.WebDav => BuildWebDav(data),
            RemoteType.OneDrive => BuildOneDrive(data),
            RemoteType.Dropbox => $"[remote]\ntype = dropbox\ntoken = {data}\n",
            RemoteType.Yandex => $"[remote]\ntype = yandex\ntoken = {data}\n",
            RemoteType.Custom => BuildCustom(data),
            _ => throw new NotSupportedException($"Remote type {remote.Type} not supported"),
        };
    }

    private static string BuildB2(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var account = root.GetProperty("Account").GetString();
        var key = root.GetProperty("Key").GetString();
        return $"[remote]\ntype = b2\naccount = {account}\nkey = {key}\n";
    }

    private static string BuildSftp(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var host = root.GetProperty("Host").GetString();
        var port = root.TryGetProperty("Port", out var p) ? p.GetInt32() : 22;
        var user = root.GetProperty("Username").GetString();
        var password = root.TryGetProperty("Password", out var pw) ? pw.GetString() : null;
        var keyFile = root.TryGetProperty("KeyFile", out var kf) ? kf.GetString() : null;

        var conf = $"[remote]\ntype = sftp\nhost = {host}\nuser = {user}\nport = {port}\n";
        if (!string.IsNullOrEmpty(keyFile))
            conf += $"key_file = {keyFile}\n";
        else if (!string.IsNullOrEmpty(password))
            conf += $"pass = {RcloneObscure.Obscure(password)}\n";
        return conf;
    }

    private static string BuildWebDav(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var url = root.GetProperty("Url").GetString();
        var vendor = root.TryGetProperty("Vendor", out var v) ? v.GetString() : "other";
        var user = root.GetProperty("Username").GetString();
        var password = root.GetProperty("Password").GetString();
        return $"[remote]\ntype = webdav\nurl = {url}\nvendor = {vendor}\nuser = {user}\n" +
               $"pass = {RcloneObscure.Obscure(password ?? string.Empty)}\n";
    }

    private static string BuildOneDrive(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var token = root.GetProperty("token").GetString();
        var driveId = root.TryGetProperty("driveId", out var d) ? d.GetString() : "";
        var driveType = root.TryGetProperty("driveType", out var t) ? t.GetString() : "personal";
        return $"[remote]\ntype = onedrive\ntoken = {token}\ndrive_id = {driveId}\ndrive_type = {driveType}\n";
    }

    private static string BuildCustom(string raw)
    {
        var lines = raw.Replace("\r\n", "\n").Split('\n');
        var body = lines
            .Where(l => !l.TrimStart().StartsWith('['))
            .Select(l => l.TrimEnd());
        return "[remote]\n" + string.Join('\n', body).Trim() + "\n";
    }

    private static string BuildS3(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var endpoint = root.GetProperty("Endpoint").GetString();
        var accessKey = root.GetProperty("AccessKey").GetString();
        var secretKey = root.GetProperty("SecretKey").GetString();
        var region = root.TryGetProperty("Region", out var r) ? r.GetString() : null;

        return $"[remote]\ntype = s3\nprovider = Other\naccess_key_id = {accessKey}\n" +
               $"secret_access_key = {secretKey}\nendpoint = {endpoint}\nregion = {region}\n";
    }
}
