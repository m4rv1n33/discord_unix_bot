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
  const userId = interaction.user.id;

  if (command === "unix-timestamp") {
    const ts = Math.floor(Date.now() / 1000);
    return interaction.reply({ embeds: [buildTimestampEmbed(ts, userId)] });
  }

  if (command === "unix-time") {
    const timeInput = interaction.options.getString("time");
    const dateInput = interaction.options.getString("date");

    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timePattern.test(timeInput)) {
      return interaction.reply(
        "❌ Invalid time format! Use `HH:mm` in 24-hour format (example: 14:30)."
      );
    }

    const userTz = timezones[userId] || "UTC";

    let day, month, year;

    if (dateInput) {
      const datePattern = /^(\d{2})-(\d{2})-(\d{4})$/;
      const dateMatch = dateInput.match(datePattern);
      if (!dateMatch) {
        return interaction.reply(
          "❌ Invalid date format! Use `dd-mm-yyyy` (example: 25-12-2025)."
        );
      }
      [, day, month, year] = dateMatch;
    } else {
      const now = new Date();
      const userDateStr = new Intl.DateTimeFormat("en-GB", {
        timeZone: userTz,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(now);
      [day, month, year] = userDateStr.split("/");
    }

    const [hh, mm] = timeInput.split(":").map(Number);

    let dateTime;
    if (userTz.startsWith("GMT")) {
      const offset = parseInt(userTz.replace("GMT", ""), 10);
      dateTime = new Date(Date.UTC(year, month - 1, day, hh - offset, mm));
    } else {
      // Correct UTC conversion from user timezone
      const localDate = new Date(`${year}-${month}-${day}T${timeInput}:00`);
      const utcMillis = Date.parse(
        new Intl.DateTimeFormat("en-US", {
          timeZone: userTz,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        }).format(localDate)
      );
      dateTime = new Date(utcMillis);
    }

    const ts = Math.floor(dateTime.getTime() / 1000);

    return interaction.reply({ embeds: [buildTimestampEmbed(ts, userId)] });
  }

  if (command === "set-timezone") {
    const tz = interaction.options.getString("timezone");

    const gmtOffsetPattern = /^GMT([+-]\d{1,2})$/i;
    if (gmtOffsetPattern.test(tz)) {
      timezones[userId] = tz.toUpperCase();
      saveTimezones();
      return interaction.reply(
        `Timezone set to **${tz.toUpperCase()}** and saved 📝`
      );
    }

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

function formatWithOffset(ts, offsetHours) {
  const date = new Date(ts * 1000);
  date.setTime(date.getTime() + offsetHours * 60 * 60 * 1000);
  return date.toLocaleString("en-GB", { dateStyle: "full", timeStyle: "long" });
}

function buildTimestampEmbed(ts, userId) {
  const tz = timezones[userId] || "UTC";

  let localDate;
  if (tz.startsWith("GMT")) {
    const offset = parseInt(tz.replace("GMT", ""), 10);
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
    .setDescription(`Timezone selected: \`${tz}\`\nLocal time: **${localDate}**`)
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
    .setFooter({
      text: `Made by @m4rv1n_33`,
      iconURL:
        "https://cdn.discordapp.com/attachments/1447708077498437846/1448039340407132271/image.jpg?ex=6939cf3a&is=69387dba&hm=8fc03d009bbce5ec92f70690dadf7360c7d3db476baab0653f024b00fd261b70&",
    });
}

function render(ts, style) {
  return `<t:${ts}:${style}>`;
}

client.login(process.env.DISCORD_TOKEN);
