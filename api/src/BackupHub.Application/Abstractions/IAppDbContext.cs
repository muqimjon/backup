using BackupHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Application.Abstractions;

public interface IAppDbContext
{
    DbSet<User> Users { get; }
    DbSet<Agent> Agents { get; }
    DbSet<Source> Sources { get; }
    DbSet<Remote> Remotes { get; }
    DbSet<BackupJob> Jobs { get; }
    DbSet<BackupRun> Runs { get; }
    DbSet<AgentCommand> Commands { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
