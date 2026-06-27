using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using BackupHub.Application.Abstractions;
using BackupHub.Application.Common;
using BackupHub.Domain.Entities;
using BackupHub.Domain.Enums;
using FluentValidation;
using FluentValidation.Results;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Application.Features.Remotes;

public sealed record RemoteDto(Guid Id, string Name, RemoteType Type, string Path);

public sealed record GetRemotesQuery : IRequest<IReadOnlyList<RemoteDto>>;

// Non-secret config of one destination, so the edit form can prefill everything
// except secrets (which are never sent back to the browser).
public sealed record RemoteDetailDto(
    Guid Id, string Name, RemoteType Type, string Path,
    string? Endpoint, string? Region, string? Account,
    string? Host, int? Port, string? Username, string? Url, string? Vendor, string? KeyFile);

public sealed record GetRemoteDetailQuery(Guid Id) : IRequest<RemoteDetailDto>;

internal sealed class GetRemoteDetailHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<GetRemoteDetailQuery, RemoteDetailDto>
{
    public async ValueTask<RemoteDetailDto> Handle(GetRemoteDetailQuery query, CancellationToken ct)
    {
        var r = await db.Remotes.FirstOrDefaultAsync(x => x.Id == query.Id, ct)
            ?? throw new NotFoundException("Destination not found");

        JsonObject cfg;
        try { cfg = JsonNode.Parse(protector.Unprotect(r.ConfigEncrypted)) as JsonObject ?? new JsonObject(); }
        catch { cfg = new JsonObject(); }

        string? S(string k) => cfg[k]?.GetValue<string>();
        int? I(string k) => cfg[k] is { } n && int.TryParse(n.ToString(), out var v) ? v : null;

        return new RemoteDetailDto(
            r.Id, r.Name, r.Type, r.Path,
            S("Endpoint"), S("Region"), S("Account"),
            S("Host"), I("Port"), S("Username"), S("Url"), S("Vendor"), S("KeyFile"));
    }
}

internal sealed class GetRemotesHandler(IAppDbContext db)
    : IRequestHandler<GetRemotesQuery, IReadOnlyList<RemoteDto>>
{
    public async ValueTask<IReadOnlyList<RemoteDto>> Handle(GetRemotesQuery query, CancellationToken ct)
        => await db.Remotes
            .OrderBy(r => r.Name)
            .Select(r => new RemoteDto(r.Id, r.Name, r.Type, r.Path))
            .ToListAsync(ct);
}

public sealed record CreateS3RemoteCommand(
    string Name,
    string Path,
    string Endpoint,
    string AccessKey,
    string SecretKey,
    string? Region) : IRequest<Guid>;

public sealed class CreateS3RemoteValidator : AbstractValidator<CreateS3RemoteCommand>
{
    public CreateS3RemoteValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Path).NotEmpty();
        RuleFor(x => x.Endpoint).NotEmpty();
        RuleFor(x => x.AccessKey).NotEmpty();
        RuleFor(x => x.SecretKey).NotEmpty();
    }
}

internal sealed class CreateS3RemoteHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<CreateS3RemoteCommand, Guid>
{
    public async ValueTask<Guid> Handle(CreateS3RemoteCommand command, CancellationToken ct)
    {
        var payload = JsonSerializer.Serialize(new
        {
            command.Endpoint,
            command.AccessKey,
            command.SecretKey,
            command.Region,
        });

        var remote = new Remote
        {
            Name = command.Name,
            Type = RemoteType.S3,
            Path = command.Path,
            ConfigEncrypted = protector.Protect(payload),
        };

        db.Remotes.Add(remote);
        await db.SaveChangesAsync(ct);
        return remote.Id;
    }
}

public sealed record CreateB2RemoteCommand(string Name, string Path, string Account, string Key) : IRequest<Guid>;

public sealed class CreateB2RemoteValidator : AbstractValidator<CreateB2RemoteCommand>
{
    public CreateB2RemoteValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Path).NotEmpty();
        RuleFor(x => x.Account).NotEmpty();
        RuleFor(x => x.Key).NotEmpty();
    }
}

internal sealed class CreateB2RemoteHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<CreateB2RemoteCommand, Guid>
{
    public async ValueTask<Guid> Handle(CreateB2RemoteCommand command, CancellationToken ct)
    {
        var payload = JsonSerializer.Serialize(new { command.Account, command.Key });
        var remote = new Remote { Name = command.Name, Type = RemoteType.B2, Path = command.Path, ConfigEncrypted = protector.Protect(payload) };
        db.Remotes.Add(remote);
        await db.SaveChangesAsync(ct);
        return remote.Id;
    }
}

public sealed record CreateSftpRemoteCommand(
    string Name, string Path, string Host, int Port, string Username, string? Password, string? KeyFile, string? KeyPem) : IRequest<Guid>;

public sealed class CreateSftpRemoteValidator : AbstractValidator<CreateSftpRemoteCommand>
{
    public CreateSftpRemoteValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Path).NotEmpty();
        RuleFor(x => x.Host).NotEmpty();
        RuleFor(x => x.Username).NotEmpty();
        RuleFor(x => x).Must(x => !string.IsNullOrEmpty(x.Password) || !string.IsNullOrEmpty(x.KeyFile) || !string.IsNullOrEmpty(x.KeyPem))
            .WithMessage("A password, a private key, or a key file path is required");
    }
}

internal sealed class CreateSftpRemoteHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<CreateSftpRemoteCommand, Guid>
{
    public async ValueTask<Guid> Handle(CreateSftpRemoteCommand command, CancellationToken ct)
    {
        var payload = JsonSerializer.Serialize(new
        {
            command.Host,
            Port = command.Port <= 0 ? 22 : command.Port,
            command.Username,
            command.Password,
            command.KeyFile,
            command.KeyPem,
        });
        var remote = new Remote { Name = command.Name, Type = RemoteType.Sftp, Path = command.Path, ConfigEncrypted = protector.Protect(payload) };
        db.Remotes.Add(remote);
        await db.SaveChangesAsync(ct);
        return remote.Id;
    }
}

public sealed record CreateWebDavRemoteCommand(
    string Name, string Path, string Url, string Vendor, string Username, string Password) : IRequest<Guid>;

public sealed class CreateWebDavRemoteValidator : AbstractValidator<CreateWebDavRemoteCommand>
{
    public CreateWebDavRemoteValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Path).NotEmpty();
        RuleFor(x => x.Url).NotEmpty();
        RuleFor(x => x.Username).NotEmpty();
        RuleFor(x => x.Password).NotEmpty();
    }
}

internal sealed class CreateWebDavRemoteHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<CreateWebDavRemoteCommand, Guid>
{
    public async ValueTask<Guid> Handle(CreateWebDavRemoteCommand command, CancellationToken ct)
    {
        var payload = JsonSerializer.Serialize(new
        {
            command.Url,
            Vendor = string.IsNullOrWhiteSpace(command.Vendor) ? "other" : command.Vendor,
            command.Username,
            command.Password,
        });
        var remote = new Remote { Name = command.Name, Type = RemoteType.WebDav, Path = command.Path, ConfigEncrypted = protector.Protect(payload) };
        db.Remotes.Add(remote);
        await db.SaveChangesAsync(ct);
        return remote.Id;
    }
}

public sealed record CreateCustomRemoteCommand(string Name, string Path, string RcloneConfig) : IRequest<Guid>;

public sealed class CreateCustomRemoteValidator : AbstractValidator<CreateCustomRemoteCommand>
{
    public CreateCustomRemoteValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Path).NotEmpty();
        RuleFor(x => x.RcloneConfig).NotEmpty().Must(c => c.Contains('=')).WithMessage("Paste a valid rclone config block (key = value lines)");
    }
}

internal sealed class CreateCustomRemoteHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<CreateCustomRemoteCommand, Guid>
{
    public async ValueTask<Guid> Handle(CreateCustomRemoteCommand command, CancellationToken ct)
    {
        var remote = new Remote { Name = command.Name, Type = RemoteType.Custom, Path = command.Path, ConfigEncrypted = protector.Protect(command.RcloneConfig) };
        db.Remotes.Add(remote);
        await db.SaveChangesAsync(ct);
        return remote.Id;
    }
}

public sealed record StoreOneDriveRemoteCommand(string Name, string Path, string ConfigJson) : IRequest<Guid>;

internal sealed class StoreOneDriveRemoteHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<StoreOneDriveRemoteCommand, Guid>
{
    public async ValueTask<Guid> Handle(StoreOneDriveRemoteCommand command, CancellationToken ct)
    {
        var remote = new Remote
        {
            Name = command.Name,
            Type = RemoteType.OneDrive,
            Path = command.Path,
            ConfigEncrypted = protector.Protect(command.ConfigJson),
        };
        db.Remotes.Add(remote);
        await db.SaveChangesAsync(ct);
        return remote.Id;
    }
}

public sealed record StoreDropboxRemoteCommand(string Name, string Path, string TokenJson) : IRequest<Guid>;

internal sealed class StoreDropboxRemoteHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<StoreDropboxRemoteCommand, Guid>
{
    public async ValueTask<Guid> Handle(StoreDropboxRemoteCommand command, CancellationToken ct)
    {
        var remote = new Remote { Name = command.Name, Type = RemoteType.Dropbox, Path = command.Path, ConfigEncrypted = protector.Protect(command.TokenJson) };
        db.Remotes.Add(remote);
        await db.SaveChangesAsync(ct);
        return remote.Id;
    }
}

public sealed record StoreYandexRemoteCommand(string Name, string Path, string TokenJson) : IRequest<Guid>;

internal sealed class StoreYandexRemoteHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<StoreYandexRemoteCommand, Guid>
{
    public async ValueTask<Guid> Handle(StoreYandexRemoteCommand command, CancellationToken ct)
    {
        var remote = new Remote { Name = command.Name, Type = RemoteType.Yandex, Path = command.Path, ConfigEncrypted = protector.Protect(command.TokenJson) };
        db.Remotes.Add(remote);
        await db.SaveChangesAsync(ct);
        return remote.Id;
    }
}

// ── Editing existing destinations ───────────────────────────────────────────
// Name + path are always updatable. Secret fields are only overwritten when a
// new value is supplied; a blank field keeps whatever is already stored (the UI
// never receives stored secrets back, so "blank" means "unchanged").

internal static class RemoteEdit
{
    public static async Task<Remote> Load(IAppDbContext db, Guid id, CancellationToken ct)
        => await db.Remotes.FirstOrDefaultAsync(r => r.Id == id, ct)
           ?? throw new NotFoundException("Destination not found");

    public static JsonObject Config(ISecretProtector protector, Remote remote)
        => JsonNode.Parse(protector.Unprotect(remote.ConfigEncrypted)) as JsonObject ?? new JsonObject();

    public static void Keep(JsonObject cfg, string key, string? value)
    {
        if (!string.IsNullOrEmpty(value)) cfg[key] = value;
    }
}

public sealed record UpdateRemoteMetaCommand(Guid Id, string Name, string Path) : IRequest<bool>;

public sealed class UpdateRemoteMetaValidator : AbstractValidator<UpdateRemoteMetaCommand>
{
    public UpdateRemoteMetaValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Path).NotEmpty();
    }
}

internal sealed class UpdateRemoteMetaHandler(IAppDbContext db) : IRequestHandler<UpdateRemoteMetaCommand, bool>
{
    public async ValueTask<bool> Handle(UpdateRemoteMetaCommand command, CancellationToken ct)
    {
        var remote = await RemoteEdit.Load(db, command.Id, ct);
        remote.Name = command.Name;
        remote.Path = command.Path;
        await db.SaveChangesAsync(ct);
        return true;
    }
}

public sealed record UpdateS3RemoteCommand(
    Guid Id, string Name, string Path, string Endpoint, string? AccessKey, string? SecretKey, string? Region) : IRequest<bool>;

internal sealed class UpdateS3RemoteHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<UpdateS3RemoteCommand, bool>
{
    public async ValueTask<bool> Handle(UpdateS3RemoteCommand c, CancellationToken ct)
    {
        var remote = await RemoteEdit.Load(db, c.Id, ct);
        var cfg = RemoteEdit.Config(protector, remote);
        cfg["Endpoint"] = c.Endpoint;
        cfg["Region"] = c.Region;
        RemoteEdit.Keep(cfg, "AccessKey", c.AccessKey);
        RemoteEdit.Keep(cfg, "SecretKey", c.SecretKey);
        remote.Name = c.Name; remote.Path = c.Path;
        remote.ConfigEncrypted = protector.Protect(cfg.ToJsonString());
        await db.SaveChangesAsync(ct);
        return true;
    }
}

public sealed record UpdateB2RemoteCommand(Guid Id, string Name, string Path, string Account, string? Key) : IRequest<bool>;

internal sealed class UpdateB2RemoteHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<UpdateB2RemoteCommand, bool>
{
    public async ValueTask<bool> Handle(UpdateB2RemoteCommand c, CancellationToken ct)
    {
        var remote = await RemoteEdit.Load(db, c.Id, ct);
        var cfg = RemoteEdit.Config(protector, remote);
        cfg["Account"] = c.Account;
        RemoteEdit.Keep(cfg, "Key", c.Key);
        remote.Name = c.Name; remote.Path = c.Path;
        remote.ConfigEncrypted = protector.Protect(cfg.ToJsonString());
        await db.SaveChangesAsync(ct);
        return true;
    }
}

public sealed record UpdateSftpRemoteCommand(
    Guid Id, string Name, string Path, string Host, int Port, string Username, string? Password, string? KeyFile, string? KeyPem) : IRequest<bool>;

internal sealed class UpdateSftpRemoteHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<UpdateSftpRemoteCommand, bool>
{
    public async ValueTask<bool> Handle(UpdateSftpRemoteCommand c, CancellationToken ct)
    {
        var remote = await RemoteEdit.Load(db, c.Id, ct);
        var cfg = RemoteEdit.Config(protector, remote);
        cfg["Host"] = c.Host;
        cfg["Port"] = c.Port <= 0 ? 22 : c.Port;
        cfg["Username"] = c.Username;
        RemoteEdit.Keep(cfg, "Password", c.Password);
        RemoteEdit.Keep(cfg, "KeyFile", c.KeyFile);
        RemoteEdit.Keep(cfg, "KeyPem", c.KeyPem);
        remote.Name = c.Name; remote.Path = c.Path;
        remote.ConfigEncrypted = protector.Protect(cfg.ToJsonString());
        await db.SaveChangesAsync(ct);
        return true;
    }
}

public sealed record UpdateWebDavRemoteCommand(
    Guid Id, string Name, string Path, string Url, string Vendor, string Username, string? Password) : IRequest<bool>;

internal sealed class UpdateWebDavRemoteHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<UpdateWebDavRemoteCommand, bool>
{
    public async ValueTask<bool> Handle(UpdateWebDavRemoteCommand c, CancellationToken ct)
    {
        var remote = await RemoteEdit.Load(db, c.Id, ct);
        var cfg = RemoteEdit.Config(protector, remote);
        cfg["Url"] = c.Url;
        cfg["Vendor"] = string.IsNullOrWhiteSpace(c.Vendor) ? "other" : c.Vendor;
        cfg["Username"] = c.Username;
        RemoteEdit.Keep(cfg, "Password", c.Password);
        remote.Name = c.Name; remote.Path = c.Path;
        remote.ConfigEncrypted = protector.Protect(cfg.ToJsonString());
        await db.SaveChangesAsync(ct);
        return true;
    }
}

public sealed record UpdateCustomRemoteCommand(Guid Id, string Name, string Path, string? RcloneConfig) : IRequest<bool>;

internal sealed class UpdateCustomRemoteHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<UpdateCustomRemoteCommand, bool>
{
    public async ValueTask<bool> Handle(UpdateCustomRemoteCommand c, CancellationToken ct)
    {
        var remote = await RemoteEdit.Load(db, c.Id, ct);
        remote.Name = c.Name; remote.Path = c.Path;
        // The whole rclone block is the secret: blank = keep existing.
        if (!string.IsNullOrWhiteSpace(c.RcloneConfig))
            remote.ConfigEncrypted = protector.Protect(c.RcloneConfig);
        await db.SaveChangesAsync(ct);
        return true;
    }
}

// ── "Easy" OAuth: paste a token from `rclone authorize "<backend>"` ──────────
// The user runs the command on their own machine; rclone does the browser login
// with its OWN built-in client, so there's no Google Cloud / Azure / Yandex app
// to create and no redirect URI to register. They paste the printed token here.
// RcloneConfigFactory builds these backends' config with just the token (no
// client_id), which is exactly what a built-in-client token needs to refresh.

internal static class RcloneToken
{
    public static readonly IReadOnlyDictionary<string, RemoteType> Supported = new Dictionary<string, RemoteType>(StringComparer.OrdinalIgnoreCase)
    {
        ["drive"] = RemoteType.GoogleDrive,
        ["dropbox"] = RemoteType.Dropbox,
        ["yandex"] = RemoteType.Yandex,
    };

    // `rclone authorize` prints raw token JSON or a base64 blob, sometimes wrapped
    // as "Paste the following … ---> <blob> <---End paste". Accept every variant.
    public static string Normalize(string raw)
    {
        var s = raw.Trim();

        var start = s.IndexOf("--->", StringComparison.Ordinal);
        var end = s.IndexOf("<---", StringComparison.Ordinal);
        if (start >= 0 && end > start) s = s[(start + 4)..end].Trim();

        if (s.Length > 0 && s[0] != '{')
        {
            try
            {
                var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(s));
                if (decoded.TrimStart().StartsWith('{')) s = decoded.Trim();
            }
            catch (FormatException) { /* not base64 — fall through to JSON parse */ }
        }

        var open = s.IndexOf('{');
        var close = s.LastIndexOf('}');
        if (open >= 0 && close > open) s = s[open..(close + 1)];

        try
        {
            using var doc = JsonDocument.Parse(s);
            if (!doc.RootElement.TryGetProperty("access_token", out _))
                throw Invalid("That token has no access_token — copy the whole block the command printed and paste it again.");
        }
        catch (JsonException)
        {
            throw Invalid("Couldn't read that as an rclone token. Copy the whole block the command printed (between the arrows) and paste it again.");
        }
        return s;
    }

    private static ValidationException Invalid(string message)
        => new([new ValidationFailure("Token", message)]);
}

public sealed record StoreRcloneTokenRemoteCommand(string Name, string Path, string Backend, string Token) : IRequest<Guid>;

public sealed class StoreRcloneTokenRemoteValidator : AbstractValidator<StoreRcloneTokenRemoteCommand>
{
    public StoreRcloneTokenRemoteValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Path).NotEmpty();
        RuleFor(x => x.Token).NotEmpty();
        RuleFor(x => x.Backend).NotEmpty()
            .Must(b => RcloneToken.Supported.ContainsKey(b))
            .WithMessage("Unsupported backend — use drive, dropbox or yandex.");
    }
}

internal sealed class StoreRcloneTokenRemoteHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<StoreRcloneTokenRemoteCommand, Guid>
{
    public async ValueTask<Guid> Handle(StoreRcloneTokenRemoteCommand command, CancellationToken ct)
    {
        var token = RcloneToken.Normalize(command.Token);
        var remote = new Remote
        {
            Name = command.Name,
            Type = RcloneToken.Supported[command.Backend],
            Path = command.Path,
            ConfigEncrypted = protector.Protect(token),
        };
        db.Remotes.Add(remote);
        await db.SaveChangesAsync(ct);
        return remote.Id;
    }
}

public sealed record StoreGoogleRemoteCommand(
    string Name, string Path, string TokenJson, string? ClientId, string? ClientSecret) : IRequest<Guid>;

internal sealed class StoreGoogleRemoteHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<StoreGoogleRemoteCommand, Guid>
{
    public async ValueTask<Guid> Handle(StoreGoogleRemoteCommand command, CancellationToken ct)
    {
        // Wrap the token with the OAuth client that minted it — rclone needs that
        // same client_id/secret to refresh the token once it expires (~1 hour).
        var config = JsonSerializer.Serialize(new
        {
            token = command.TokenJson,
            clientId = command.ClientId,
            clientSecret = command.ClientSecret,
        });

        var remote = new Remote
        {
            Name = command.Name,
            Type = RemoteType.GoogleDrive,
            Path = command.Path,
            ConfigEncrypted = protector.Protect(config),
        };

        db.Remotes.Add(remote);
        await db.SaveChangesAsync(ct);
        return remote.Id;
    }
}
