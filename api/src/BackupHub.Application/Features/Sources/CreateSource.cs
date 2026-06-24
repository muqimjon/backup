using BackupHub.Application.Abstractions;
using BackupHub.Domain.Entities;
using BackupHub.Domain.Enums;
using FluentValidation;
using Mediator;

namespace BackupHub.Application.Features.Sources;

public sealed record CreateSourceCommand(
    string Name,
    BackupEngine Engine,
    string Host,
    int Port,
    string Username,
    string Secret,
    string Target) : IRequest<Guid>;

public sealed class CreateSourceValidator : AbstractValidator<CreateSourceCommand>
{
    public CreateSourceValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Host).NotEmpty();
        RuleFor(x => x.Port).InclusiveBetween(1, 65535);
        RuleFor(x => x.Username).NotEmpty();
        RuleFor(x => x.Target).NotEmpty();
    }
}

internal sealed class CreateSourceHandler(IAppDbContext db, ISecretProtector protector)
    : IRequestHandler<CreateSourceCommand, Guid>
{
    public async ValueTask<Guid> Handle(CreateSourceCommand command, CancellationToken ct)
    {
        var source = new Source
        {
            Name = command.Name,
            Engine = command.Engine,
            Host = command.Host,
            Port = command.Port,
            Username = command.Username,
            SecretEncrypted = protector.Protect(command.Secret),
            Target = command.Target,
        };

        db.Sources.Add(source);
        await db.SaveChangesAsync(ct);
        return source.Id;
    }
}
