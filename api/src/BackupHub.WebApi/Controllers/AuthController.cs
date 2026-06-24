using BackupHub.Application.Features.Auth;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackupHub.WebApi.Controllers;

[AllowAnonymous]
public sealed class AuthController(ISender mediator) : ApiController(mediator)
{
    [HttpPost("login")]
    public async Task<ActionResult<AuthResult>> Login(LoginCommand command, CancellationToken ct)
        => Ok(await Mediator.Send(command, ct));
}
