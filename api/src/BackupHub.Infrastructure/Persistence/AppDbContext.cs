using BackupHub.Application.Abstractions;
using BackupHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace BackupHub.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options), IAppDbContext
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Agent> Agents => Set<Agent>();
    public DbSet<Source> Sources => Set<Source>();
    public DbSet<Remote> Remotes => Set<Remote>();
    public DbSet<BackupJob> Jobs => Set<BackupJob>();
    public DbSet<BackupRun> Runs => Set<BackupRun>();
    public DbSet<AgentCommand> Commands => Set<AgentCommand>();
    public DbSet<Setting> Settings => Set<Setting>();
    public DbSet<BackupArtifact> Artifacts => Set<BackupArtifact>();
    public DbSet<TelegramChat> TelegramChats => Set<TelegramChat>();
    public DbSet<EmailRecipient> EmailRecipients => Set<EmailRecipient>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<DateTimeOffset>().HaveConversion<DateTimeOffsetToBinaryConverter>();
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        builder.Entity<User>().HasIndex(u => u.Username).IsUnique();
        builder.Entity<Agent>().HasIndex(a => new { a.Hostname, a.Project });
        builder.Entity<BackupRun>().HasIndex(r => r.StartedAt);
        builder.Entity<AgentCommand>().HasIndex(c => new { c.AgentId, c.AckedAt });
        builder.Entity<Setting>().HasIndex(s => s.Key).IsUnique();
        builder.Entity<BackupArtifact>().HasIndex(a => new { a.JobId, a.FileName }).IsUnique();
        builder.Entity<EmailRecipient>().HasIndex(e => e.Email).IsUnique();

        builder.Entity<BackupJob>()
            .HasOne(j => j.Source).WithMany().HasForeignKey(j => j.SourceId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.Entity<BackupJob>()
            .HasOne(j => j.Remote).WithMany().HasForeignKey(j => j.RemoteId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.Entity<BackupRun>()
            .HasOne(r => r.Job).WithMany(j => j.Runs).HasForeignKey(r => r.JobId)
            .OnDelete(DeleteBehavior.Cascade);

        base.OnModelCreating(builder);
    }
}
