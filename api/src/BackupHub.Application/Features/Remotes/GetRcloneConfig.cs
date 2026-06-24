using BackupHub.Application.Abstractions;
using BackupHub.Application.Common;
using Mediator;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Application.Features.Remotes;

public sealed record GetRcloneConfigQuery(Guid RemoteId) : IRequest<string>;

internal sealed class GetRcloneConfigHandler(IAppDbContext db, IRcloneConfigFactory factory)
    : IRequestHandler<GetRcloneConfigQuery, string>
{
    public async ValueTask<string> Handle(GetRcloneConfigQuery query, CancellationToken ct)
    {
        var remote = await db.Remotes.FirstOrDefaultAsync(r => r.Id == query.RemoteId, ct)
            ?? throw new NotFoundException("Remote not found");

        return factory.Build(remote);
    }
}
