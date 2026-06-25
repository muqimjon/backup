using BackupHub.Application.Abstractions;
using Mediator;

namespace BackupHub.Application.Features.Settings;

public sealed record SettingsDto(bool GoogleConfigured);

public sealed record GetSettingsQuery : IRequest<SettingsDto>;

internal sealed class GetSettingsHandler(ISettingsService settings)
    : IRequestHandler<GetSettingsQuery, SettingsDto>
{
    public async ValueTask<SettingsDto> Handle(GetSettingsQuery query, CancellationToken ct)
    {
        var stored = await settings.GetManyAsync(["Google.ClientId", "Google.ClientSecret"], ct);
        var configured = stored.ContainsKey("Google.ClientId") && stored.ContainsKey("Google.ClientSecret");
        return new SettingsDto(configured);
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
