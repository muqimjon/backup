using Mediator;
using Microsoft.AspNetCore.Mvc;

namespace BackupHub.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public abstract class ApiController(ISender mediator) : ControllerBase
{
    protected ISender Mediator { get; } = mediator;
}
