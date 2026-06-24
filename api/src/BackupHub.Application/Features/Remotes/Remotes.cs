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
