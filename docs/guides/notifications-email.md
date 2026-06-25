# Email (SMTP) notifications

Zaxira sends mail through **your own** SMTP server. Nothing is shared — credentials
are encrypted at rest. Configure it in **Settings → Notifications → Email**.

## Gmail (most common)

1. Enable **2-Step Verification** on your Google account.
2. Create an **App Password**: <https://myaccount.google.com/apppasswords>
   (Google no longer allows your normal password for SMTP.)
3. In Zaxira → Settings → Notifications → **Email**:
   - **Host:** `smtp.gmail.com`
   - **Port:** `587`
   - **Username:** your full Gmail address
   - **Password:** the 16-character app password
   - **From:** your Gmail address
   - **Recipients:** add one or more addresses (each with its own delete button)
4. **Save**, then **Send test** to confirm.

## Other providers

| Provider | Host | Port |
|---|---|---|
| Outlook / Microsoft 365 | `smtp.office365.com` | 587 |
| Yahoo | `smtp.mail.yahoo.com` | 587 |
| Zoho | `smtp.zoho.com` | 587 |
| Yandex | `smtp.yandex.com` | 587 (use an [app password](https://id.yandex.com/security/app-passwords)) |
| Mail.ru | `smtp.mail.ru` | 587 (app password in account security) |
| iCloud | `smtp.mail.me.com` | 587 (needs an Apple [app-specific password](https://appleid.apple.com), From = your iCloud address) |
| SendGrid | `smtp.sendgrid.net` | 587 (user = `apikey`) |
| Mailgun | `smtp.mailgun.org` | 587 |

> Port **587** uses STARTTLS (recommended). If a provider only offers 465 (implicit TLS)
> and it fails, prefer their 587 endpoint.

## Multiple recipients

Add as many recipients as you want in the **Recipients** list — every notification goes
to all of them.
