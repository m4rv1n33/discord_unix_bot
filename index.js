const fs = require("fs");
const path = require("path");
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder 
} = require("discord.js");
const moment = require('moment-timezone');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Storage configuration
const VOLUME_PATH = "/data"; // Railway volume mount point
const TZ_FILE = path.join(VOLUME_PATH, "timezones.json");
const BACKUP_FILE = path.join(__dirname, ".timezones_backup.json"); // Gitignored local backup

console.log("🚀 Starting Discord Unix Timestamp Bot");
console.log("=== Storage Configuration ===");

// Initialize storage system
let storageReady = false;
let usingPersistentStorage = true;

try {
  // Ensure volume directory exists
  if (!fs.existsSync(VOLUME_PATH)) {
    console.log(`Creating directory: ${VOLUME_PATH}`);
    fs.mkdirSync(VOLUME_PATH, { recursive: true, mode: 0o755 });
    console.log("✅ Directory created");
  }
  
  // Test write permissions
  const testFile = path.join(VOLUME_PATH, ".write_test");
  fs.writeFileSync(testFile, "test");
  fs.readFileSync(testFile, "utf8");
  fs.unlinkSync(testFile);
  
  storageReady = true;
  console.log("✅ Volume storage is ready and writable");
  console.log(`📄 Primary storage: ${TZ_FILE}`);
  
} catch (error) {
  console.error("❌ Volume storage failed:", error.message);
  console.warn("⚠️  Falling back to local storage (data may be lost on redeploy)");
  usingPersistentStorage = false;
}

console.log(`📋 Backup file: ${BACKUP_FILE}`);
console.log(`💾 Persistent: ${usingPersistentStorage ? "YES" : "NO (data at risk)"}`);
console.log("=== End Configuration ===\n");

// Load timezones with smart fallback
let timezones = {};
let loadedSource = "none";

function loadTimezones() {
  // Try primary storage first
  if (fs.existsSync(TZ_FILE)) {
    try {
      const data = fs.readFileSync(TZ_FILE, "utf8");
      timezones = JSON.parse(data);
      loadedSource = "volume";
      console.log(`📊 Loaded ${Object.keys(timezones).length} timezone(s) from volume storage`);
      return;
    } catch (error) {
      console.error("Error loading from volume:", error.message);
    }
  }
  
  // Try backup file
  if (fs.existsSync(BACKUP_FILE)) {
    try {
      const data = fs.readFileSync(BACKUP_FILE, "utf8");
      timezones = JSON.parse(data);
      loadedSource = "backup";
      console.log(`📊 Loaded ${Object.keys(timezones).length} timezone(s) from backup`);
      
      // Restore to primary storage if possible
      if (storageReady) {
        try {
          fs.writeFileSync(TZ_FILE, JSON.stringify(timezones, null, 2));
          console.log("✅ Restored backup to volume storage");
        } catch (error) {
          console.error("Could not restore to volume:", error.message);
        }
      }
      return;
    } catch (error) {
      console.error("Error loading from backup:", error.message);
    }
  }
  
  console.log("🆕 No timezone data found, starting fresh");
  loadedSource = "fresh";
}

// Initialize
loadTimezones();

// Save timezones with dual backup
function saveTimezones() {
  const count = Object.keys(timezones).length;
  
  try {
    // Save to primary storage if available
    if (storageReady) {
      fs.writeFileSync(TZ_FILE, JSON.stringify(timezones, null, 2));
    }
    
    // Always save backup
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(timezones, null, 2));
    
    console.log(`💾 Saved ${count} timezone(s) to:`);
    if (storageReady) console.log(`   Volume: ${TZ_FILE}`);
    console.log(`   Backup: ${BACKUP_FILE}`);
    
    return true;
  } catch (error) {
    console.error("💥 Save failed:", error.message);
    return false;
  }
}

// Admin check helper function
function isAdmin(userId) {
  // Check if user is in admin list from environment
  const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
  
  // Check if user is bot owner
  if (process.env.OWNER_ID && userId === process.env.OWNER_ID) {
    return true;
  }
  
  // Check if user is in admin list
  if (adminIds.includes(userId)) {
    return true;
  }
  
  return false;
}

// Extended admin check for interactions
function checkAdmin(interaction) {
  const userId = interaction.user.id;
  
  // Check environment admin list first
  if (isAdmin(userId)) {
    return true;
  }
  
  // If in a guild, check for Administrator permission
  if (interaction.guild) {
    const member = interaction.guild.members.cache.get(userId);
    if (member && member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return true;
    }
  }
  
  return false;
}

// Bot event handlers
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`📡 Serving ${client.guilds.cache.size} guild(s)`);
  console.log(`👤 Admin users: ${process.env.ADMIN_IDS || 'None configured'}`);
  console.log(`👑 Bot owner: ${process.env.OWNER_ID || 'Not set'}`);
});

client.on("interactionCreate", async (interaction) => {
  // Handle context menu commands (User commands)
  if (interaction.isUserContextMenuCommand()) {
    const command = interaction.commandName;
    const targetUser = interaction.targetUser;
    
    if (command === 'Get Unix Timestamp') {
      const ts = Math.floor(Date.now() / 1000);
      const targetTz = timezones[targetUser.id] || "UTC";
      
      const embed = new EmbedBuilder()
        .setColor("#6366f1")
        .setTitle(`Timestamp for ${targetUser.username}`)
        .setDescription(`**Unix Timestamp:** \`${ts}\``)
        .addFields(
          { name: "Raw", value: `\`\`\`${ts}\`\`\``, inline: false },
          { name: "Relative", value: `<t:${ts}:R>`, inline: true },
          { name: "Full", value: `<t:${ts}:F>`, inline: true }
        )
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    if (command === 'Set Timezone for User') {
      // Check if user has admin permissions
      if (!checkAdmin(interaction)) {
        return interaction.reply({
          content: "❌ This command requires administrator permissions.",
          ephemeral: true
        });
      }
      
      // Create modal for setting timezone
      const modal = new ModalBuilder()
        .setCustomId(`set_tz_modal_${targetUser.id}`)
        .setTitle(`Set Timezone for ${targetUser.username}`);
      
      const timezoneInput = new TextInputBuilder()
        .setCustomId('timezone_input')
        .setLabel("Timezone (e.g., Europe/Zurich)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(timezones[targetUser.id] || "UTC");
      
      const firstActionRow = new ActionRowBuilder().addComponents(timezoneInput);
      modal.addComponents(firstActionRow);
      
      return interaction.showModal(modal);
    }
    
    return;
  }
  
  // Handle modal submissions
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('set_tz_modal_')) {
      const targetUserId = interaction.customId.replace('set_tz_modal_', '');
      const timezone = interaction.fields.getTextInputValue('timezone_input');
      
      // Validate timezone
      if (!moment.tz.zone(timezone)) {
        return interaction.reply({
          content: `❌ Invalid timezone: \`${timezone}\``,
          ephemeral: true
        });
      }
      
      timezones[targetUserId] = timezone;
      saveTimezones();
      
      return interaction.reply({
        content: `✅ Set timezone for <@${targetUserId}> to \`${timezone}\``,
        ephemeral: true
      });
    }
  }
  
  // Handle regular slash commands
  if (!interaction.isChatInputCommand()) return;
  
  const command = interaction.commandName;
  const userId = interaction.user.id;
  
  console.log(`Received command: ${command} from user: ${userId}`);
  
  // Admin command checks
  if (command === "storage-status" || command === "backup-timezones") {
    if (!checkAdmin(interaction)) {
      return interaction.reply({
        content: "❌ This command requires administrator permissions.",
        ephemeral: true
      });
    }
  }
  
  if (command === "unix-timestamp") {
    const ts = Math.floor(Date.now() / 1000);
    return interaction.reply({ embeds: [buildTimestampEmbed(ts, userId)] });
  }
  
  if (command === "unix-time") {
    const timeInput = interaction.options.getString("time");
    const dateInput = interaction.options.getString("date");
    const userTz = timezones[userId] || "UTC";
    
    console.log(`Processing time: ${timeInput}, date: ${dateInput || 'today'}, tz: ${userTz}`);
    
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
      console.log(`Converted to timestamp: ${ts}`);
      
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
    
    console.log(`Setting timezone for ${userId} to ${tz}`);
    
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
  
  if (command === "storage-status") {
    const stats = {
      volumePath: VOLUME_PATH,
      timezoneFile: TZ_FILE,
      backupFile: BACKUP_FILE,
      storageReady,
      usingPersistentStorage,
      loadedSource,
      timezoneCount: Object.keys(timezones).length,
      fileExists: fs.existsSync(TZ_FILE),
      backupExists: fs.existsSync(BACKUP_FILE),
      volumeWritable: storageReady,
      userId: interaction.user.id,
      isAdmin: checkAdmin(interaction),
      guild: interaction.guild ? interaction.guild.name : "DM"
    };
    
    if (fs.existsSync(TZ_FILE)) {
      stats.fileSize = fs.statSync(TZ_FILE).size;
      stats.lastModified = fs.statSync(TZ_FILE).mtime;
    }
    
    const embed = new EmbedBuilder()
      .setColor("#6366f1")
      .setTitle("Storage Status")
      .setDescription(`**Bot Storage Information**\nLoaded from: \`${loadedSource}\``)
      .addFields(
        { name: "Timezone Count", value: `${stats.timezoneCount} users`, inline: true },
        { name: "Persistent Storage", value: stats.usingPersistentStorage ? "✅ Yes" : "❌ No", inline: true },
        { name: "Volume Writable", value: stats.volumeWritable ? "✅ Yes" : "❌ No", inline: true },
        { name: "Primary File", value: stats.fileExists ? `✅ ${stats.fileSize} bytes` : "❌ Missing", inline: true },
        { name: "Backup File", value: stats.backupExists ? "✅ Exists" : "❌ Missing", inline: true },
        { name: "Context", value: `${stats.guild}\nUser ID: ${stats.userId}\nAdmin: ${stats.isAdmin ? "✅" : "❌"}`, inline: true }
      )
      .setFooter({ text: `Storage Status • ${new Date().toLocaleString()}` })
      .setTimestamp();
    
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  
  if (command === "backup-timezones") {
    const json = JSON.stringify(timezones, null, 2);
    const timestamp = moment().format('YYYYMMDD_HHmmss');
    const count = Object.keys(timezones).length;
    
    return interaction.reply({
      content: `**Timezone Backup**\nTotal users: ${count}\nLoaded from: ${loadedSource}`,
      files: [{
        attachment: Buffer.from(json, 'utf8'),
        name: `timezones_backup_${timestamp}.json`
      }],
      ephemeral: true
    });
  }
});

function buildTimestampEmbed(ts, userId) {
  const tz = timezones[userId] || "UTC";
  const date = new Date(ts * 1000);
  
  const m = moment.unix(ts).tz(tz);
  const formatted = m.format('dddd, MMMM D, YYYY [at] h:mm:ss A [(]z[)]');
  const isoString = date.toISOString();
  const now = moment();
  const relativeTime = m.from(now);
  
  // Get user mention if in a guild context
  const userMention = userId ? `<@${userId}>` : "User";

  return new EmbedBuilder()
    .setColor("#6366f1")
    .setTitle("Timestamp Converter")
    .setDescription(`**Local time in \`${tz}\`**\n${formatted}\n*For: ${userMention}*`)
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

// Error handling
client.on("error", (error) => {
  console.error("Discord.js error:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

// Start bot
console.log("🔗 Connecting to Discord...");
client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error("❌ Failed to login:", error);
  process.exit(1);
});