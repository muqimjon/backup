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
            _ => throw new NotSupportedException($"Remote type {remote.Type} not supported"),
        };
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
