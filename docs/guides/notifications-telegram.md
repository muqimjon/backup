# Telegram notifications

Zaxira uses **your own** Telegram bot. Creating one takes ~1 minute and means no
shared credentials and no rate-limit surprises.

## 1. Create a bot

1. In Telegram, open **[@BotFather](https://t.me/BotFather)**.
2. Send `/newbot`, choose a name and a username ending in `bot`.
3. BotFather replies with a **token** like `123456789:AAH...`. Copy it.

## 2. Connect it

- **Settings → Notifications → Telegram**
- Paste the token and press **Connect**.
- Zaxira verifies the token with Telegram (an invalid token is rejected immediately).

## 3. Link your chat (with a 6-digit code)

1. Open **your** bot in Telegram and press **Start**.
2. The bot replies with a **6-digit code**.
3. Back in Zaxira, enter the code and press **Link**.
4. Your chat appears in the list (with your name). Repeat for **as many people as you
   want** — each linked chat receives notifications.

## Group chats

Add the bot to a Telegram **group**, then send `/start@yourbot` in the group. The bot DMs
the code; enter it the same way to notify the whole group.

> Remove a chat any time with the **delete** button next to it.
