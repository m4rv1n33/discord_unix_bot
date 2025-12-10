const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const moment = require('moment-timezone');

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
    const userTz = timezones[userId] || "UTC";

    // Validate time format (HH:mm)
    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timePattern.test(timeInput)) {
      return interaction.reply(
        "❌ Invalid time format! Use `HH:mm` in 24-hour format (example: 14:30)."
      );
    }

    let dateStr;
    
    if (dateInput) {
      // Validate date format (dd-mm-yyyy)
      const datePattern = /^(\d{2})-(\d{2})-(\d{4})$/;
      const dateMatch = dateInput.match(datePattern);
      if (!dateMatch) {
        return interaction.reply(
          "❌ Invalid date format! Use `dd-mm-yyyy` (example: 25-12-2025)."
        );
      }
      // Format as YYYY-MM-DD for moment parsing
      dateStr = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]} ${timeInput}`;
    } else {
      // Use current date in user's timezone
      const now = moment().tz(userTz);
      dateStr = `${now.format('YYYY-MM-DD')} ${timeInput}`;
    }

    try {
      // Parse the date in the user's timezone
      const m = moment.tz(dateStr, 'YYYY-MM-DD HH:mm', userTz);
      
      if (!m.isValid()) {
        return interaction.reply("❌ Invalid date/time combination.");
      }
      
      // Convert to Unix timestamp
      const ts = m.unix();

      return interaction.reply({ embeds: [buildTimestampEmbed(ts, userId)] });
    } catch (error) {
      console.error("Error parsing date:", error);
      return interaction.reply("❌ An error occurred while processing the time.");
    }
  }

  if (command === "set-timezone") {
    const tz = interaction.options.getString("timezone");

    try {
      // Validate timezone using moment-timezone
      if (!moment.tz.zone(tz)) {
        return interaction.reply(
          "❌ Invalid timezone. Use IANA timezone like `Europe/Zurich`."
        );
      }
      
      timezones[userId] = tz;
      saveTimezones();
      return interaction.reply(`✅ Timezone set to **${tz}** and saved 📝`);
    } catch (error) {
      return interaction.reply(
        "❌ Invalid timezone. Use IANA timezone like `Europe/Zurich`."
      );
    }
  }
});

function buildTimestampEmbed(ts, userId) {
  const tz = timezones[userId] || "UTC";

  // Format the timestamp using moment-timezone for consistency
  const m = moment.unix(ts).tz(tz);
  const formatted = m.format('dddd, MMMM D, YYYY [at] h:mm:ss A [(]z[)]');

  return new EmbedBuilder()
    .setColor("#f200ff")
    .setTitle("Unix Time Converter")
    .setDescription(`Timezone selected: \`${tz}\`\nLocal time: **${formatted}**`)
    .addFields(
      { name: "Short Time", value: `<t:${ts}:t>`, inline: true },
      { name: "Long Time", value: `<t:${ts}:T>`, inline: true },
      { name: "Short Date", value: `<t:${ts}:d>`, inline: true },
      { name: "Long Date", value: `<t:${ts}:D>`, inline: true },
      { name: "Short Date & Time", value: `<t:${ts}:f>`, inline: true },
      { name: "Full Date & Time", value: `<t:${ts}:F>`, inline: true },
      { name: "Relative Time", value: `<t:${ts}:R>`, inline: true }
    )
    .setFooter({
      text: `Made by @m4rv1n_33`,
      iconURL:
        "https://cdn.discordapp.com/attachments/1447708077498437846/1448039340407132271/image.jpg",
    });
}

client.login(process.env.DISCORD_TOKEN);