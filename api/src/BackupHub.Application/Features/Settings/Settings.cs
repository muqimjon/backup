using BackupHub.Application.Abstractions;
using Mediator;

namespace BackupHub.Application.Features.Settings;

public sealed record SettingsDto(bool GoogleConfigured, bool OneDriveConfigured, bool DropboxConfigured, bool YandexConfigured);

public sealed record GetSettingsQuery : IRequest<SettingsDto>;

internal sealed class GetSettingsHandler(ISettingsService settings)
    : IRequestHandler<GetSettingsQuery, SettingsDto>
{
    public async ValueTask<SettingsDto> Handle(GetSettingsQuery query, CancellationToken ct)
    {
        var stored = await settings.GetManyAsync(
        [
            "Google.ClientId", "Google.ClientSecret", "OneDrive.ClientId", "OneDrive.ClientSecret",
            "Dropbox.ClientId", "Dropbox.ClientSecret", "Yandex.ClientId", "Yandex.ClientSecret",
        ], ct);
        bool Has(string p) => stored.ContainsKey($"{p}.ClientId") && stored.ContainsKey($"{p}.ClientSecret");
        return new SettingsDto(Has("Google"), Has("OneDrive"), Has("Dropbox"), Has("Yandex"));
    }
}

public sealed record UpdateGoogleSettingsCommand(string ClientId, string ClientSecret) : IRequest<bool>;

internal sealed class UpdateGoogleSettingsHandler(ISettingsService settings)
    : IRequestHandler<UpdateGoogleSettingsCommand, bool>
{
    public async ValueTask<bool> Handle(UpdateGoogleSettingsCommand command, CancellationToken ct)
    {
        await settings.SetAsync("Google.ClientId", command.ClientId.Trim(), ct);
        await settings.SetAsync("Google.ClientSecret", command.ClientSecret.Trim(), ct);
        return true;
    }
}

public sealed record UpdateOneDriveSettingsCommand(string ClientId, string ClientSecret) : IRequest<bool>;

internal sealed class UpdateOneDriveSettingsHandler(ISettingsService settings)
    : IRequestHandler<UpdateOneDriveSettingsCommand, bool>
{
    public async ValueTask<bool> Handle(UpdateOneDriveSettingsCommand command, CancellationToken ct)
    {
        await settings.SetAsync("OneDrive.ClientId", command.ClientId.Trim(), ct);
        await settings.SetAsync("OneDrive.ClientSecret", command.ClientSecret.Trim(), ct);
        return true;
    }
}

public sealed record UpdateDropboxSettingsCommand(string ClientId, string ClientSecret) : IRequest<bool>;

internal sealed class UpdateDropboxSettingsHandler(ISettingsService settings)
    : IRequestHandler<UpdateDropboxSettingsCommand, bool>
{
    public async ValueTask<bool> Handle(UpdateDropboxSettingsCommand command, CancellationToken ct)
    {
        await settings.SetAsync("Dropbox.ClientId", command.ClientId.Trim(), ct);
        await settings.SetAsync("Dropbox.ClientSecret", command.ClientSecret.Trim(), ct);
        return true;
    }
}

public sealed record UpdateYandexSettingsCommand(string ClientId, string ClientSecret) : IRequest<bool>;

internal sealed class UpdateYandexSettingsHandler(ISettingsService settings)
    : IRequestHandler<UpdateYandexSettingsCommand, bool>
{
    public async ValueTask<bool> Handle(UpdateYandexSettingsCommand command, CancellationToken ct)
    {
        await settings.SetAsync("Yandex.ClientId", command.ClientId.Trim(), ct);
        await settings.SetAsync("Yandex.ClientSecret", command.ClientSecret.Trim(), ct);
        return true;
    }
}

public sealed record UpdateLocaleCommand(string Locale) : IRequest<bool>;

internal sealed class UpdateLocaleHandler(ISettingsService settings)
    : IRequestHandler<UpdateLocaleCommand, bool>
{
    public async ValueTask<bool> Handle(UpdateLocaleCommand command, CancellationToken ct)
    {
        var locale = command.Locale is "ru" or "uz" ? command.Locale : "en";
        await settings.SetAsync("App.Lang", locale, ct);
        return true;
    }
}
