using BackupHub.Application.Abstractions;
using BackupHub.Domain.Entities;
using BackupHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BackupHub.Infrastructure.Settings;

public sealed class SettingsService(AppDbContext db, ISecretProtector protector) : ISettingsService
{
    public async Task<string?> GetAsync(string key, CancellationToken ct = default)
    {
        var row = await db.Settings.FirstOrDefaultAsync(s => s.Key == key, ct);
        return row is null ? null : Safe(() => protector.Unprotect(row.ValueEncrypted));
    }

    public async Task<IReadOnlyDictionary<string, string>> GetManyAsync(IEnumerable<string> keys, CancellationToken ct = default)
    {
        var set = keys.ToHashSet();
        var rows = await db.Settings.Where(s => set.Contains(s.Key)).ToListAsync(ct);
        var result = new Dictionary<string, string>();
        foreach (var row in rows)
        {
            var value = Safe(() => protector.Unprotect(row.ValueEncrypted));
            if (value is not null)
                result[row.Key] = value;
        }
        return result;
    }

    public async Task SetAsync(string key, string? value, CancellationToken ct = default)
    {
        var row = await db.Settings.FirstOrDefaultAsync(s => s.Key == key, ct);

        if (string.IsNullOrEmpty(value))
        {
            if (row is not null)
                db.Settings.Remove(row);
        }
        else if (row is null)
        {
            db.Settings.Add(new Setting { Key = key, ValueEncrypted = protector.Protect(value) });
        }
        else
        {
            row.ValueEncrypted = protector.Protect(value);
        }

        await db.SaveChangesAsync(ct);
    }

    private static string? Safe(Func<string> f)
    {
        try { return f(); }
        catch { return null; }
    }
}
