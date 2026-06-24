using BackupHub.Application.Abstractions;
using BackupHub.Application.Common;
using FluentValidation;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Application.Features.Auth;

public sealed record AuthResult(string Token, string Username, string Role);

public sealed record LoginCommand(string Username, string Password) : IRequest<AuthResult>;

public sealed class LoginValidator : AbstractValidator<LoginCommand>
{
    public LoginValidator()
    {
        RuleFor(x => x.Username).NotEmpty();
        RuleFor(x => x.Password).NotEmpty();
    }
}

internal sealed class LoginHandler(IAppDbContext db, IPasswordHasher hasher, IJwtTokenService jwt)
    : IRequestHandler<LoginCommand, AuthResult>
{
    public async ValueTask<AuthResult> Handle(LoginCommand command, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Username == command.Username, ct)
            ?? throw new UnauthorizedAppException("Invalid credentials");

        if (!hasher.Verify(command.Password, user.PasswordHash))
            throw new UnauthorizedAppException("Invalid credentials");

        var token = jwt.CreateToken(user.Id, user.Username, user.Role);
        return new AuthResult(token, user.Username, user.Role);
    }
}
