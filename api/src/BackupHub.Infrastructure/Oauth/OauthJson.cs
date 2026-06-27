using System.Text.Encodings.Web;
using System.Text.Json;

namespace BackupHub.Infrastructure.Oauth;

// rclone reads OAuth tokens out of an INI config file, then JSON-parses them.
// The default System.Text.Json encoder escapes '+' (and '<', '>', '&', …) as
// \uXXXX — and a backslash inside the INI value trips rclone's config reader,
// so the token's expiry/fields fail to parse. Serialize tokens with the relaxed
// encoder so those characters stay literal and rclone reads them back cleanly.
internal static class OauthJson
{
    private static readonly JsonSerializerOptions Options = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public static string Serialize<T>(T value) => JsonSerializer.Serialize(value, Options);
}
