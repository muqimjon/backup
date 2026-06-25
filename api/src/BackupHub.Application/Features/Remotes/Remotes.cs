using System.Text.Json;
using BackupHub.Application.Abstractions;
using BackupHub.Domain.Entities;
using BackupHub.Domain.Enums;
using FluentValidation;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Application.Features.Remotes;

public sealed record RemoteDto(Guid Id, string Name, RemoteType Type, string Path);

public sealed record GetRemotesQuery : IRequest<IReadOnlyList<RemoteDto>>;

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
    string Name, string Path, string Host, int Port, string Username, string? Password, string? KeyFile) : IRequest<Guid>;

public sealed class CreateSftpRemoteValidator : AbstractValidator<CreateSftpRemoteCommand>
{
    public CreateSftpRemoteValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Path).NotEmpty();
        RuleFor(x => x.Host).NotEmpty();
        RuleFor(x => x.Username).NotEmpty();
        RuleFor(x => x).Must(x => !string.IsNullOrEmpty(x.Password) || !string.IsNullOrEmpty(x.KeyFile))
            .WithMessage("Either a password or a key file is required");
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

public sealed record StoreGoogleRemoteCommand(string Name, string Path, string TokenJson) : IRequest<Guid>;

internal sealed class StoreGoogleRemoteHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<StoreGoogleRemoteCommand, Guid>
{
    public async ValueTask<Guid> Handle(StoreGoogleRemoteCommand command, CancellationToken ct)
    {
        var remote = new Remote
        {
            Name = command.Name,
            Type = RemoteType.GoogleDrive,
            Path = command.Path,
            ConfigEncrypted = protector.Protect(command.TokenJson),
        };

        db.Remotes.Add(remote);
        await db.SaveChangesAsync(ct);
        return remote.Id;
    }
}
