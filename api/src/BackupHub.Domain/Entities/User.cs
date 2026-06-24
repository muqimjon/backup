using BackupHub.Domain.Common;

namespace BackupHub.Domain.Entities;

public class User : BaseEntity
{
    public string Username { get; set; } = default!;
    public string PasswordHash { get; set; } = default!;
    public string Role { get; set; } = "Admin";
}
