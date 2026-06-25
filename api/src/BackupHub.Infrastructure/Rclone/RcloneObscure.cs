using System.Security.Cryptography;
using System.Text;

namespace BackupHub.Infrastructure.Rclone;

internal static class RcloneObscure
{
    private static readonly byte[] CryptKey =
    [
        0x9c, 0x93, 0x5b, 0x48, 0x73, 0x0a, 0x55, 0x4d,
        0x6b, 0xfd, 0x7c, 0x63, 0xc8, 0x86, 0xa9, 0x2b,
        0xd3, 0x90, 0x19, 0x8e, 0xb8, 0x12, 0x8a, 0xfb,
        0xf4, 0xde, 0x16, 0x2b, 0x8b, 0x95, 0xf6, 0x38,
    ];

    public static string Obscure(string plaintext)
    {
        var data = Encoding.UTF8.GetBytes(plaintext);
        var iv = RandomNumberGenerator.GetBytes(16);
        var cipher = new byte[data.Length];
        CtrXor(data, cipher, iv);

        var output = new byte[iv.Length + cipher.Length];
        Buffer.BlockCopy(iv, 0, output, 0, iv.Length);
        Buffer.BlockCopy(cipher, 0, output, iv.Length, cipher.Length);

        return Convert.ToBase64String(output).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static void CtrXor(byte[] input, byte[] output, byte[] iv)
    {
        using var aes = Aes.Create();
        aes.Key = CryptKey;
        aes.Mode = CipherMode.ECB;
        aes.Padding = PaddingMode.None;
        using var encryptor = aes.CreateEncryptor();

        var counter = (byte[])iv.Clone();
        var keystream = new byte[16];

        for (var offset = 0; offset < input.Length; offset += 16)
        {
            encryptor.TransformBlock(counter, 0, 16, keystream, 0);
            var n = Math.Min(16, input.Length - offset);
            for (var i = 0; i < n; i++)
                output[offset + i] = (byte)(input[offset + i] ^ keystream[i]);
            Increment(counter);
        }
    }

    private static void Increment(byte[] counter)
    {
        for (var i = counter.Length - 1; i >= 0; i--)
            if (++counter[i] != 0)
                break;
    }
}
