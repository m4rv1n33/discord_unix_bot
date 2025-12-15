# 🕒 Discord Unix Timestamp Bot

A powerful **Discord bot** that converts human-readable dates and times into **Unix timestamps**, supports personal timezones, and includes admin diagnostics — all via **slash commands** and **context menu actions**.

Built with **Node.js**, **discord.js v14**, and **moment-timezone**.

---

## 🚀 Live Bot

This bot is **hosted live and running** on Discord (24/7).
Invite link: [Click me!](https://discord.com/oauth2/authorize?client_id=1447713694338256956&permissions=2147485696&integration_type=0&scope=bot+applications.commands)

---

## 📦 Features

- 🔢 Convert dates & times into Unix timestamps  
- 🕒 Get the current Unix timestamp instantly  
- 🌍 User-specific timezone support  
- 🖱 Context menu (right-click) commands  
- 🛠 Admin-only diagnostics & backups  
- 📡 Optional webhook logging  

---

## 📥 Installation

### 1. Clone the repository
```bash
git clone https://github.com/m4rv1n33/discord_unix_bot
cd discord_unix_bot
```

### 2. Install dependencies
```bash
npm install
```

### 3. Create a `.env` file
```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_client_id
GUILD_ID=optional_testing_guild_id

LOG_WEBHOOK_URL=optional_discord_webhook
ADMIN_IDS=comma,separated,admin,ids
OWNER_ID=your_user_id
```

---

## 🔁 Deploy Commands

Slash commands and context menu commands must be registered before use.

```bash
node deploy-commands.js
```

This registers:
- Slash commands
- User context menu commands
- Admin-only tools

---

## ▶️ Run the Bot

```bash
node index.js
```

---

## 💬 Commands

### ✔ Slash Commands

| Command | Description |
|-------|-------------|
| `/unix-timestamp` | Returns the **current Unix timestamp** |
| `/unix-time time:<HH:mm> date:<dd-mm-yyyy>` | Converts the provided date and time into a Unix timestamp with discord formatting |
| `/set-timezone timezone:<IANA>` | Sets your personal timezone (e.g. `Europe/Zurich`) |
| `/storage-status` | **Admin:** Shows file & storage health |
| `/backup-timezones` | **Admin:** Downloads a backup of stored timezones |
| `/view-logs` | **Admin:** Displays bot status & stats |
| `/force-status` | **Admin:** Sends a forced status report to the logging webhook |

---

### 🖱 Context Menu Commands

(Available via right-click on a user)

| Name | Description |
|-----|-------------|
| **Get Unix Timestamp** | Returns the current Unix timestamp |
| **Set Timezone for User** | **Admin:** Set another user’s timezone via modal |

---

## ⏱ How Time Conversion Works

- Times are parsed using **moment-timezone**
- If no date is supplied, today’s date in the user’s timezone is used
- If no timezone is set, UTC is used per default
- Output is returned as a Unix timestamp
---

## 🌍 Timezone Storage

- User timezones are stored in `timezones.json`
- A backup file `.timezones_backup.json` is automatically created
- Admins can download backups using `/backup-timezones`

---

## 🛠 Admin & Permissions

Admin commands are available if:
- The user has **Administrator** permissions, or
- Their user ID is listed in `ADMIN_IDS`, or
- They match `OWNER_ID`

---

## 📡 Logging

If `LOG_WEBHOOK_URL` is set, the bot will send:
- Startup logs
- Periodic status updates
- Error reports
- Manual `/force-status` reports

to the configured Discord webhook.

---

## 📦 Dependencies

- **discord.js** - Discord API wrapper  
- **moment-timezone** - Time parsing & timezone support  
- Node.js built-in modules (`fs`, `path`)

---

## 📝 Example Usage

**Get current timestamp**
```
/unix-timestamp
```

**Convert a date & time**
```
/unix-time time:14:30 date:15-12-2025
```

**Set your timezone**
```
/set-timezone timezone:Europe/Zurich
```
