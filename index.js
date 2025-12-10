const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const moment = require('moment-timezone');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// timezone save file
const tzFile = path.join(__dirname, "data", "timezones.json");

// Create data directory if it doesn't exist
const dataDir = path.dirname(tzFile);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// load saved timezones (if any)
let timezones = {};
if (fs.existsSync(tzFile)) {
  try {
    timezones = JSON.parse(fs.readFileSync(tzFile, "utf8"));
  } catch (error) {
    console.error("Error loading timezones:", error);
  }
}

// save tz to file
function saveTimezones() {
  try {
    fs.writeFileSync(tzFile, JSON.stringify(timezones, null, 4));
  } catch (error) {
    console.error("Error saving timezones:", error);
  }
}

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
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
      return interaction.reply({
        content: "**Invalid time format**\nUse `HH:mm` in 24-hour format (example: `14:30`).",
        ephemeral: true
      });
    }

    try {
      let m;
      
      if (dateInput) {
        // Validate date format (dd-mm-yyyy)
        const datePattern = /^(\d{2})-(\d{2})-(\d{4})$/;
        const dateMatch = dateInput.match(datePattern);
        if (!dateMatch) {
          return interaction.reply({
            content: "**Invalid date format**\nUse `dd-mm-yyyy` (example: `25-12-2025`).",
            ephemeral: true
          });
        }
        // Format as DD-MM-YYYY HH:mm for moment parsing
        const dateStr = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]} ${timeInput}`;
        m = moment.tz(dateStr, 'DD-MM-YYYY HH:mm', userTz);
      } else {
        // Use current date with specified time
        const today = moment().tz(userTz);
        const dateStr = `${today.format('DD-MM-YYYY')} ${timeInput}`;
        m = moment.tz(dateStr, 'DD-MM-YYYY HH:mm', userTz);
      }
      
      if (!m.isValid()) {
        return interaction.reply({
          content: "Invalid date/time combination.",
          ephemeral: true
        });
      }
      
      // Convert to Unix timestamp
      const ts = m.unix();

      return interaction.reply({ embeds: [buildTimestampEmbed(ts, userId)] });
    } catch (error) {
      console.error("Error processing time:", error);
      return interaction.reply({
        content: "An error occurred while processing the time.",
        ephemeral: true
      });
    }
  }

  if (command === "set-timezone") {
    const tz = interaction.options.getString("timezone");

    try {
      // Validate timezone using moment-timezone
      if (!moment.tz.zone(tz)) {
        return interaction.reply({
          content: "**Invalid timezone**\nUse IANA timezone format like `Europe/Zurich`.",
          ephemeral: true
        });
      }
      
      timezones[userId] = tz;
      saveTimezones();
      
      // Get current time in new timezone for confirmation
      const now = moment().tz(tz);
      const timeStr = now.format('HH:mm');
      const dateStr = now.format('DD/MM/YYYY');
      
      return interaction.reply({
        content: `**Timezone updated**\n\`${tz}\`\n**Current time:** ${timeStr} • ${dateStr}`,
        ephemeral: false
      });
    } catch (error) {
      console.error("Error setting timezone:", error);
      return interaction.reply({
        content: "**Invalid timezone**\nUse IANA timezone format like `Europe/Zurich`.",
        ephemeral: true
      });
    }
  }
});

function buildTimestampEmbed(ts, userId) {
  const tz = timezones[userId] || "UTC";
  const date = new Date(ts * 1000);
  
  // Format the timestamp using moment-timezone
  const m = moment.unix(ts).tz(tz);
  const formatted = m.format('dddd, MMMM D, YYYY [at] h:mm:ss A [(]z[)]');
  
  // Get ISO string for additional precision
  const isoString = date.toISOString();
  
  // Calculate relative time
  const now = moment();
  const relativeTime = m.from(now);

  return new EmbedBuilder()
    .setColor("#6366f1") // Modern indigo color
    .setTitle("Timestamp Converter")
    .setDescription(`**Local time in \`${tz}\`**\n${formatted}`)
    .addFields(
      { 
        name: "Raw Unix Timestamp", 
        value: `\`\`\`${ts}\`\`\``, 
        inline: false 
      },
      { 
        name: "ISO 8601", 
        value: `\`\`\`${isoString}\`\`\``, 
        inline: false 
      },
      { 
        name: "Relative Time", 
        value: `\`<t:${ts}:R>\` • ${relativeTime}`, 
        inline: true 
      },
      { 
        name: "Date & Time", 
        value: `\`<t:${ts}:f>\`\n<t:${ts}:f>`, 
        inline: true 
      },
      { 
        name: "Full Format", 
        value: `\`<t:${ts}:F>\`\n<t:${ts}:F>`, 
        inline: true 
      },
      { 
        name: "Time Only", 
        value: `\`<t:${ts}:T>\`\n<t:${ts}:T>`, 
        inline: true 
      },
      { 
        name: "Date Only", 
        value: `\`<t:${ts}:D>\`\n<t:${ts}:D>`, 
        inline: true 
      },
      { 
        name: "Short Date", 
        value: `\`<t:${ts}:d>\`\n<t:${ts}:d>`, 
        inline: true 
      },
      { 
        name: "Short Time", 
        value: `\`<t:${ts}:t>\`\n<t:${ts}:t>`, 
        inline: true 
      }
    )
    .setFooter({
      text: `Made by @m4rv1n_33 • ID: ${ts}`,
      iconURL: "https://cdn.discordapp.com/attachments/1447708077498437846/1448039340407132271/image.jpg",
    })
    .setTimestamp();
}

// Handle errors
client.on("error", console.error);
process.on("unhandledRejection", console.error);

client.login(process.env.DISCORD_TOKEN);