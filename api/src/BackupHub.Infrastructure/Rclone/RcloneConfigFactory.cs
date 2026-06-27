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
            RemoteType.GoogleDrive => BuildGoogleDrive(data),
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

    // Google Drive config is stored two ways:
    //  • a wrapper { token, clientId?, clientSecret? } — the in-app web OAuth flow,
    //    where the token was minted by the user's own OAuth client. rclone MUST get
    //    that client_id/secret too, or it can't refresh the token after ~1 hour.
    //  • a bare rclone token JSON — from `rclone authorize "drive"`, which uses
    //    rclone's built-in client, so no client_id belongs in the config.
    private static string BuildGoogleDrive(string data)
    {
        var token = data;
        string? clientId = null, clientSecret = null;
        try
        {
            using var doc = JsonDocument.Parse(data);
            var root = doc.RootElement;
            if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("token", out var t))
            {
                token = t.GetString() ?? data;
                clientId = root.TryGetProperty("clientId", out var ci) ? ci.GetString() : null;
                clientSecret = root.TryGetProperty("clientSecret", out var cs) ? cs.GetString() : null;
            }
        }
        catch (JsonException) { /* bare token — use it verbatim */ }

        var conf = "[remote]\ntype = drive\nscope = drive\n";
        if (!string.IsNullOrEmpty(clientId)) conf += $"client_id = {clientId}\n";
        if (!string.IsNullOrEmpty(clientSecret)) conf += $"client_secret = {clientSecret}\n";
        conf += $"token = {token}\n";
        return conf;
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
        var keyPem = root.TryGetProperty("KeyPem", out var kp) ? kp.GetString() : null;

        var conf = $"[remote]\ntype = sftp\nhost = {host}\nuser = {user}\nport = {port}\n";
        if (!string.IsNullOrEmpty(keyPem))
            // rclone un-escapes literal "\n" back to newlines in key_pem, so the
            // whole PEM fits on one config line.
            conf += $"key_pem = {keyPem.Replace("\r\n", "\n").Replace("\n", "\\n")}\n";
        else if (!string.IsNullOrEmpty(keyFile))
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
