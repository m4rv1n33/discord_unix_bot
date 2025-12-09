require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// timezone save file
const tzFile = path.join(__dirname, "data", "timezones.json");

// load saved timezones (if any)
let timezones = {};
if (fs.existsSync(tzFile)) {
  timezones = JSON.parse(fs.readFileSync(tzFile, "utf8"));
}

// save tz to file
function saveTimezones() {
  fs.writeFileSync(tzFile, JSON.stringify(timezones, null, 4));
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.commandName;
  const userId = interaction.user.id; // the user id for per-user tz

  // /unix-timestamp

  if (command === "unix-timestamp") {
    const ts = Math.floor(Date.now() / 1000);
    return interaction.reply({ embeds: [buildTimestampEmbed(ts, userId)] });
  }

  // /unix-time

  if (command === "unix-time") {
    const userId = interaction.user.id;
    const timeInput = interaction.options.getString("time"); // required
    const dateInput = interaction.options.getString("date"); // optional

    // Validate time (HH:mm)
    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timePattern.test(timeInput)) {
      return interaction.reply(
        "❌ Invalid time format! Use `HH:mm` in 24-hour format (example: 14:30)."
      );
    }

    // Determine user's timezone
    const userTz = timezones[userId] || "UTC";

    // Determine the date to use
    let day, month, year;

    if (dateInput) {
      // validate dd-mm-yyyy
      const datePattern = /^(\d{2})-(\d{2})-(\d{4})$/;
      const dateMatch = dateInput.match(datePattern);
      if (!dateMatch) {
        return interaction.reply(
          "❌ Invalid date format! Use `dd-mm-yyyy` (example: 25-12-2025)."
        );
      }
      [, day, month, year] = dateMatch;
    } else {
      // default to today in user's timezone
      const now = new Date();
      if (userTz.startsWith("GMT")) {
        const offset = parseInt(userTz.replace("GMT", ""), 10);
        const userDate = new Date(now.getTime() + offset * 60 * 60 * 1000);
        day = String(userDate.getUTCDate()).padStart(2, "0");
        month = String(userDate.getUTCMonth() + 1).padStart(2, "0");
        year = String(userDate.getUTCFullYear());
      } else {
        const userDateStr = new Intl.DateTimeFormat("en-GB", {
          timeZone: userTz,
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).format(now);
        [day, month, year] = userDateStr.split("/");
      }
    }

    // Build the Date object
    const dateTime = new Date(`${year}-${month}-${day}T${timeInput}`);
    if (isNaN(dateTime)) {
      return interaction.reply("❌ Invalid date and time combination.");
    }

    const ts = Math.floor(dateTime.getTime() / 1000);

    // Reply with the timestamp embed
    return interaction.reply({ embeds: [buildTimestampEmbed(ts, userId)] });
  }

  // /set-timezone (actually works now lol)
  if (command === "set-timezone") {
    const tz = interaction.options.getString("timezone");

    // check if user entered GMT+/-offset
    const gmtOffsetPattern = /^GMT([+-]\d{1,2})$/i;
    if (gmtOffsetPattern.test(tz)) {
      timezones[userId] = tz.toUpperCase();
      saveTimezones();
      return interaction.reply(
        `Timezone set to **${tz.toUpperCase()}** and saved 📝`
      );
    }

    // otherwise validate IANA timezone
    try {
      Intl.DateTimeFormat("en-GB", { timeZone: tz });
      timezones[userId] = tz;
      saveTimezones();
      return interaction.reply(`Timezone set to **${tz}** and saved 📝`);
    } catch {
      return interaction.reply(
        "❌ Invalid timezone. Use IANA timezone like `Europe/Zurich` or GMT offsets like `GMT+2`."
      );
    }
  }
});

// gmt offset support
function formatWithOffset(ts, offsetHours) {
  const date = new Date(ts * 1000);
  date.setTime(date.getTime() + offsetHours * 60 * 60 * 1000);
  return date.toLocaleString("en-GB", { dateStyle: "full", timeStyle: "long" });
}

// embed builder
function buildTimestampEmbed(ts, userId) {
  const tz = timezones[userId] || "UTC"; // use saved tz or default UTC

  let localDate;
  if (tz.startsWith("GMT")) {
    const offset = parseInt(tz.replace("GMT", ""), 10); // parse offset
    localDate = formatWithOffset(ts, offset);
  } else {
    localDate = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "full",
      timeStyle: "long",
      timeZone: tz,
    }).format(new Date(ts * 1000));
  }

  return new EmbedBuilder()
    .setColor("#f200ff")
    .setTitle("Unix Time Converter")
    .setDescription(
      `Timezone selected: \`${tz}\`\nLocal time: **${localDate}**`
    )
    .addFields(
      {
        name: "Short Time",
        value: `${render(ts, "t")} • \`<t:${ts}:t>\``,
        inline: false,
      },
      {
        name: "Long Time",
        value: `${render(ts, "T")} • \`<t:${ts}:T>\``,
        inline: false,
      },
      {
        name: "Short Date",
        value: `${render(ts, "d")} • \`<t:${ts}:d>\``,
        inline: false,
      },
      {
        name: "Long Date",
        value: `${render(ts, "D")} • \`<t:${ts}:D>\``,
        inline: false,
      },
      {
        name: "Short Date & Time",
        value: `${render(ts, "f")} • \`<t:${ts}:f>\``,
        inline: false,
      },
      {
        name: "Full Date & Time",
        value: `${render(ts, "F")} • \`<t:${ts}:F>\``,
        inline: false,
      },
      {
        name: "Relative Time",
        value: `${render(ts, "R")} • \`<t:${ts}:R>\``,
        inline: false,
      }
    )
    .setFooter({ text: `Made by @m4rv1n_33` });
}

function render(ts, style) {
  return `<t:${ts}:${style}>`;
}

// bot token login
client.login(process.env.DISCORD_TOKEN);
