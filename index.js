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

client.once("clientReady", () => {
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
    const userTz = timezones[userId] || "UTC";

    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timePattern.test(timeInput)) {
      return interaction.reply(
        "❌ Invalid time format! Use `HH:mm` in 24-hour format (example: 14:30)."
      );
    }

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
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: userTz,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(now).split("/");
      [day, month, year] = parts;
    }

    const [hh, mm] = timeInput.split(":").map(Number);

    // Create Date object in UTC based on local IANA time
    const localDate = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), hh, mm)
    );

    // Calculate timestamp in the user timezone
    const tzOffsetMs = localDate.getTime() - Number(
      new Date(
        localDate.toLocaleString("en-US", { timeZone: "UTC" })
      )
    );
    const ts = Math.floor((localDate.getTime() - tzOffsetMs) / 1000);

    return interaction.reply({ embeds: [buildTimestampEmbed(ts, userId)] });
  }

  if (command === "set-timezone") {
    const tz = interaction.options.getString("timezone");

    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      timezones[userId] = tz;
      saveTimezones();
      return interaction.reply(`Timezone set to **${tz}** and saved 📝`);
    } catch {
      return interaction.reply(
        "❌ Invalid timezone. Use IANA timezone like `Europe/Zurich`."
      );
    }
  }
});

function buildTimestampEmbed(ts, userId) {
  const tz = timezones[userId] || "UTC";

  const localDate = new Date(ts * 1000);
  const formatted = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "long",
    timeZone: tz,
  }).format(localDate);

  return new EmbedBuilder()
    .setColor("#f200ff")
    .setTitle("Unix Time Converter")
    .setDescription(`Timezone selected: \`${tz}\`\nLocal time: **${formatted}**`)
    .addFields(
      { name: "Short Time", value: `<t:${ts}:t>`, inline: false },
      { name: "Long Time", value: `<t:${ts}:T>`, inline: false },
      { name: "Short Date", value: `<t:${ts}:d>`, inline: false },
      { name: "Long Date", value: `<t:${ts}:D>`, inline: false },
      { name: "Short Date & Time", value: `<t:${ts}:f>`, inline: false },
      { name: "Full Date & Time", value: `<t:${ts}:F>`, inline: false },
      { name: "Relative Time", value: `<t:${ts}:R>`, inline: false }
    )
    .setFooter({
      text: `Made by @m4rv1n_33`,
      iconURL:
        "https://cdn.discordapp.com/attachments/1447708077498437846/1448039340407132271/image.jpg",
    });
}

client.login(process.env.DISCORD_TOKEN);
