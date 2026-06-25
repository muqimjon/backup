using BackupHub.Application.Abstractions;
using BackupHub.Infrastructure.Oauth;
using Microsoft.AspNetCore.DataProtection;
using BackupHub.Infrastructure.Persistence;
using BackupHub.Infrastructure.Rclone;
using BackupHub.Infrastructure.Security;
using BackupHub.Infrastructure.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace BackupHub.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        var connection = config.GetConnectionString("Default") ?? "Data Source=backuphub.db";
        services.AddDbContext<AppDbContext>(options => options.UseSqlite(connection));
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

        var keysPath = config["DataProtection:KeysPath"] ?? "keys";
        services.AddDataProtection()
            .PersistKeysToFileSystem(new DirectoryInfo(keysPath))
            .SetApplicationName("BackupHub");

        services.Configure<JwtOptions>(config.GetSection("Jwt"));

        services.AddSingleton<IPasswordHasher, PasswordHasher>();
        services.AddSingleton<ISecretProtector, SecretProtector>();
        services.AddSingleton<IJwtTokenService, JwtTokenService>();
        services.AddSingleton<IRcloneConfigFactory, RcloneConfigFactory>();
        services.AddScoped<ISettingsService, SettingsService>();
        services.AddHttpClient<IGoogleOAuthService, GoogleOAuthService>();
        services.AddHttpClient<INotificationSender, Notifications.NotificationSender>();
        services.AddHostedService<Notifications.TelegramPoller>();

        return services;
    }
}
