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
  ActionRowBuilder,
  WebhookClient
} = require("discord.js");
const moment = require('moment-timezone');

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds
  ] 
});

// Configuration
const VOLUME_PATH = "/data";
const TZ_FILE = path.join(VOLUME_PATH, "timezones.json");
const BACKUP_FILE = path.join(__dirname, ".timezones_backup.json");

// Webhook Logger with status scheduling
class WebhookLogger {
  constructor(webhookUrl) {
    this.webhook = webhookUrl ? new WebhookClient({ url: webhookUrl }) : null;
    this.statusInterval = null;
    this.lastStatusTime = null;
  }

  getColorForLevel(level) {
    const colors = {
      'INFO': '#3498db',
      'WARN': '#f39c12',
      'ERROR': '#e74c3c',
      'DEBUG': '#9b59b6',
      'SUCCESS': '#2ecc71',
      'STARTUP': '#9b59b6',
      'STATUS': '#6366f1'  // Color for status reports
    };
    return colors[level] || '#95a5a6';
  }

  getLevelIcon(level) {
    const icons = {
      'INFO': 'Information',
      'WARN': 'Warning',
      'ERROR': 'Error',
      'DEBUG': 'Debug',
      'SUCCESS': 'Success',
      'STARTUP': 'Startup',
      'STATUS': 'Status Report'
    };
    return icons[level] || 'Log';
  }

  async sendToWebhook(content, level = 'INFO') {
    if (!this.webhook) {
      console.log(`[${level}] ${content}`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(this.getColorForLevel(level))
      .setTitle(`${this.getLevelIcon(level)} - ${level}`)
      .setDescription(`\`\`\`${content.slice(0, 3900)}\`\`\``)
      .setTimestamp()
      .setFooter({ text: 'Unix Timestamp Bot Logger' });

    try {
      await this.webhook.send({
        username: 'Bot Logger',
        avatarURL: 'https://cdn.discordapp.com/attachments/1447708077498437846/1448039340407132271/image.jpg',
        embeds: [embed]
      });
      console.log(`[${level}] ${content}`);
    } catch (error) {
      console.log(`[${level}] ${content}`);
      console.log(`Webhook error: ${error.message}`);
    }
  }

  // Method to send status embed
  async sendStatusEmbed(client, storageReady, usingPersistentStorage, loadedSource, timezones) {
    if (!this.webhook) return;
    
    this.lastStatusTime = new Date();
    
    const stats = {
      botUptime: moment(client.readyAt).fromNow(),
      guildCount: client.guilds.cache.size,
      userCount: client.users.cache.size,
      timezoneCount: Object.keys(timezones).length,
      memoryUsage: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
      storageType: usingPersistentStorage ? 'Persistent Volume' : 'Local',
      loadedSource: loadedSource,
      storageReady: storageReady ? 'Yes' : 'No',
      lastStatus: moment().format('YYYY-MM-DD HH:mm:ss')
    };

    // Get recent command activity (last 30 minutes)
    const recentActivity = this.getRecentActivity();
    
    const embed = new EmbedBuilder()
      .setColor(this.getColorForLevel('STATUS'))
      .setTitle('Bot Status Report')
      .setDescription(`**Scheduled Status Update**\nInterval: Every 30 minutes\nLast: ${moment(this.lastStatusTime).format('HH:mm:ss')}`)
      .addFields(
        { name: 'Uptime', value: stats.botUptime, inline: true },
        { name: 'Guilds', value: `${stats.guildCount} servers`, inline: true },
        { name: 'Users', value: `${stats.userCount} users`, inline: true },
        { name: 'Timezones', value: `${stats.timezoneCount} configured`, inline: true },
        { name: 'Memory', value: stats.memoryUsage, inline: true },
        { name: 'Storage', value: stats.storageType, inline: true },
        { name: 'Storage Ready', value: stats.storageReady, inline: true },
        { name: 'Data Source', value: stats.loadedSource, inline: true },
        { name: 'Recent Activity', value: recentActivity || 'No recent activity', inline: false }
      )
      .setFooter({ text: 'Auto Status • Next update in 30 minutes' })
      .setTimestamp();

    try {
      await this.webhook.send({
        username: 'Bot Status',
        avatarURL: 'https://cdn.discordapp.com/attachments/1447708077498437846/1448039340407132271/image.jpg',
        embeds: [embed]
      });
      console.log(`[STATUS] Sent scheduled status report`);
    } catch (error) {
      console.log(`[STATUS] Failed to send status: ${error.message}`);
    }
  }

  // Start the scheduled status reporting
  startStatusSchedule(client, storageReady, usingPersistentStorage, loadedSource, timezones) {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }
    
    // Send first status immediately
    this.sendStatusEmbed(client, storageReady, usingPersistentStorage, loadedSource, timezones);
    
    // Schedule every 30 minutes (30 * 60 * 1000 = 1,800,000 ms)
    this.statusInterval = setInterval(() => {
      this.sendStatusEmbed(client, storageReady, usingPersistentStorage, loadedSource, timezones);
    }, 30 * 60 * 1000);
    
    console.log(`[STATUS] Scheduled status reports started (every 30 minutes)`);
  }

  // Stop the scheduled status reporting
  stopStatusSchedule() {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
      console.log(`[STATUS] Scheduled status reports stopped`);
    }
  }

  // Track recent activity (simplified version)
  recentCommands = [];
  
  logCommand(user, command) {
    this.recentCommands.push({
      user: user.tag || user,
      command: command,
      time: new Date()
    });
    
    // Keep only last 50 commands
    if (this.recentCommands.length > 50) {
      this.recentCommands.shift();
    }
  }
  
  getRecentActivity() {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const recent = this.recentCommands.filter(cmd => cmd.time > thirtyMinutesAgo);
    
    if (recent.length === 0) return 'No commands in last 30 minutes';
    
    // Group by command type
    const commandCounts = {};
    recent.forEach(cmd => {
      commandCounts[cmd.command] = (commandCounts[cmd.command] || 0) + 1;
    });
    
    return Object.entries(commandCounts)
      .map(([cmd, count]) => `/${cmd}: ${count}x`)
      .join(', ');
  }

  info(content) {
    this.sendToWebhook(content, 'INFO');
  }

  warn(content) {
    this.sendToWebhook(content, 'WARN');
  }

  error(content) {
    this.sendToWebhook(content, 'ERROR');
  }

  debug(content) {
    this.sendToWebhook(content, 'DEBUG');
  }

  success(content) {
    this.sendToWebhook(content, 'SUCCESS');
  }
}

// Initialize logger
let logger = null;

// Storage initialization
let storageReady = false;
let usingPersistentStorage = true;
let timezones = {};
let loadedSource = "none";

// Admin check helper function
function isAdmin(userId) {
  const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
  
  if (process.env.OWNER_ID && userId === process.env.OWNER_ID) {
    return true;
  }
  
  if (adminIds.includes(userId)) {
    return true;
  }
  
  return false;
}

// Extended admin check for interactions
function checkAdmin(interaction) {
  const userId = interaction.user.id;
  
  if (isAdmin(userId)) {
    return true;
  }
  
  if (interaction.guild) {
    const member = interaction.guild.members.cache.get(userId);
    if (member && member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return true;
    }
  }
  
  return false;
}

// Initialize storage
function initializeStorage() {
  console.log("Starting Discord Unix Timestamp Bot");
  
  try {
    if (!fs.existsSync(VOLUME_PATH)) {
      console.log(`Creating directory: ${VOLUME_PATH}`);
      fs.mkdirSync(VOLUME_PATH, { recursive: true, mode: 0o755 });
    }
    
    const testFile = path.join(VOLUME_PATH, ".write_test");
    fs.writeFileSync(testFile, "test");
    fs.readFileSync(testFile, "utf8");
    fs.unlinkSync(testFile);
    
    storageReady = true;
  } catch (error) {
    console.log(`Volume storage failed: ${error.message}`);
    usingPersistentStorage = false;
  }
}

// Load timezones
function loadTimezones() {
  if (fs.existsSync(TZ_FILE)) {
    try {
      const data = fs.readFileSync(TZ_FILE, "utf8");
      timezones = JSON.parse(data);
      loadedSource = "volume";
      if (logger) logger.info(`Loaded ${Object.keys(timezones).length} timezone(s) from volume storage`);
    } catch (error) {
      if (logger) logger.error(`Error loading from volume: ${error.message}`);
    }
  }
}

// Save timezones
function saveTimezones() {
  const count = Object.keys(timezones).length;
  try {
    if (storageReady) {
      fs.writeFileSync(TZ_FILE, JSON.stringify(timezones, null, 2));
    }
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(timezones, null, 2));
    if (logger) logger.success(`Saved ${count} timezone(s)`);
    return true;
  } catch (error) {
    if (logger) logger.error(`Save failed: ${error.message}`);
    return false;
  }
}

// Bot event handlers
client.once("ready", async () => {
  logger = new WebhookLogger(process.env.LOG_WEBHOOK_URL);
  
  // Start scheduled status reports
  if (logger.webhook) {
    logger.startStatusSchedule(client, storageReady, usingPersistentStorage, loadedSource, timezones);
  }
  
  // Send startup log
  await logger.sendToWebhook(
    `Bot Started Successfully\n` +
    `Logged in as: ${client.user.tag}\n` +
    `Guilds: ${client.guilds.cache.size}\n` +
    `Users: ${client.users.cache.size}\n` +
    `Storage: ${usingPersistentStorage ? 'Persistent' : 'Local (at risk)'}\n` +
    `Timezones loaded: ${Object.keys(timezones).length} from ${loadedSource}\n` +
    `Status reports: ${process.env.LOG_WEBHOOK_URL ? 'Scheduled every 30 minutes' : 'Disabled'}\n` +
    `Uptime: ${moment().format('YYYY-MM-DD HH:mm:ss')}`,
    'STARTUP'
  );
  
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Serving ${client.guilds.cache.size} guild(s)`);
  console.log(`Status reports: ${process.env.LOG_WEBHOOK_URL ? 'Enabled (every 30 minutes)' : 'Disabled'}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!logger) return;
  
  // Handle context menu commands
  if (interaction.isUserContextMenuCommand()) {
    const command = interaction.commandName;
    const targetUser = interaction.targetUser;
    
    logger.info(`Context menu: ${command} used by ${interaction.user.tag} on ${targetUser.tag}`);
    logger.logCommand(interaction.user, command);
    
    if (command === 'Get Unix Timestamp') {
      const ts = Math.floor(Date.now() / 1000);
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
      if (!checkAdmin(interaction)) {
        return interaction.reply({
          content: "This command requires administrator permissions.",
          ephemeral: true
        });
      }
      
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
      
      if (!moment.tz.zone(timezone)) {
        return interaction.reply({
          content: `Invalid timezone: \`${timezone}\``,
          ephemeral: true
        });
      }
      
      timezones[targetUserId] = timezone;
      saveTimezones();
      
      logger.info(`Admin ${interaction.user.tag} set timezone for user ${targetUserId} to ${timezone}`);
      
      return interaction.reply({
        content: `Set timezone for <@${targetUserId}> to \`${timezone}\``,
        ephemeral: true
      });
    }
  }
  
  // Handle regular slash commands
  if (!interaction.isChatInputCommand()) return;
  
  const command = interaction.commandName;
  const userId = interaction.user.id;
  
  logger.debug(`Command: /${command} by ${interaction.user.tag} in ${interaction.guild?.name || 'DM'}`);
  logger.logCommand(interaction.user, command);
  
  // Admin command checks
  if (command === "storage-status" || command === "backup-timezones" || command === "view-logs" || command === "force-status") {
    if (!checkAdmin(interaction)) {
      return interaction.reply({
        content: "This command requires administrator permissions.",
        ephemeral: true
      });
    }
  }
  
  if (command === "unix-timestamp") {
    const ts = Math.floor(Date.now() / 1000);
    logger.debug(`Generated timestamp: ${ts} for user ${interaction.user.tag}`);
    return interaction.reply({ embeds: [buildTimestampEmbed(ts, userId)] });
  }
  
  if (command === "unix-time") {
    const timeInput = interaction.options.getString("time");
    const dateInput = interaction.options.getString("date");
    const userTz = timezones[userId] || "UTC";
    
    logger.debug(`Processing /unix-time: ${timeInput} ${dateInput || '(no date)'} for ${userTz}`);
    
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
        const datePattern = /^(\d{2})-(\d{2})-(\d{4})$/;
        const dateMatch = dateInput.match(datePattern);
        if (!dateMatch) {
          return interaction.reply({
            content: "**Invalid date format**\nUse `dd-mm-yyyy` (example: `25-12-2025`).",
            ephemeral: true
          });
        }
        const dateStr = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]} ${timeInput}`;
        m = moment.tz(dateStr, 'DD-MM-YYYY HH:mm', userTz);
      } else {
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
      
      const ts = m.unix();
      logger.info(`User ${interaction.user.tag} converted ${timeInput} ${dateInput || ''} to timestamp: ${ts}`);
      
      return interaction.reply({ embeds: [buildTimestampEmbed(ts, userId)] });
    } catch (error) {
      logger.error(`Error in /unix-time: ${error.message}`);
      return interaction.reply({
        content: "An error occurred while processing the time.",
        ephemeral: true
      });
    }
  }
  
  if (command === "set-timezone") {
    const tz = interaction.options.getString("timezone");
    
    logger.info(`User ${interaction.user.tag} attempting to set timezone to: ${tz}`);
    
    try {
      if (!moment.tz.zone(tz)) {
        return interaction.reply({
          content: "**Invalid timezone**\nUse IANA timezone format like `Europe/Zurich`.",
          ephemeral: true
        });
      }
      
      timezones[userId] = tz;
      saveTimezones();
      
      const now = moment().tz(tz);
      const timeStr = now.format('HH:mm');
      const dateStr = now.format('DD/MM/YYYY');
      
      logger.success(`User ${interaction.user.tag} set timezone to ${tz}`);
      
      return interaction.reply({
        content: `**Timezone updated**\n\`${tz}\`\n**Current time:** ${timeStr} • ${dateStr}`,
        ephemeral: false
      });
    } catch (error) {
      logger.error(`Error setting timezone: ${error.message}`);
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
        { name: "Persistent Storage", value: stats.usingPersistentStorage ? "Yes" : "No (data at risk)", inline: true },
        { name: "Volume Writable", value: stats.volumeWritable ? "Yes" : "No", inline: true },
        { name: "Primary File", value: stats.fileExists ? `${stats.fileSize} bytes` : "Missing", inline: true },
        { name: "Backup File", value: stats.backupExists ? "Exists" : "Missing", inline: true },
        { name: "Context", value: `${stats.guild}\nUser ID: ${stats.userId}\nAdmin: ${stats.isAdmin ? "Yes" : "No"}`, inline: true }
      )
      .setFooter({ text: `Storage Status • ${new Date().toLocaleString()}` })
      .setTimestamp();
    
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  
  if (command === "backup-timezones") {
    const json = JSON.stringify(timezones, null, 2);
    const timestamp = moment().format('YYYYMMDD_HHmmss');
    const count = Object.keys(timezones).length;
    
    logger.info(`Admin ${interaction.user.tag} downloaded timezone backup (${count} users)`);
    
    return interaction.reply({
      content: `**Timezone Backup**\nTotal users: ${count}\nLoaded from: ${loadedSource}`,
      files: [{
        attachment: Buffer.from(json, 'utf8'),
        name: `timezones_backup_${timestamp}.json`
      }],
      ephemeral: true
    });
  }
  
  if (command === "view-logs") {
    const logInfo = {
      timezonesLoaded: Object.keys(timezones).length,
      storageType: usingPersistentStorage ? 'Persistent Volume' : 'Local',
      botUptime: moment(client.readyAt).fromNow(),
      guildCount: client.guilds.cache.size,
      nextStatus: logger.lastStatusTime ? moment(logger.lastStatusTime).add(30, 'minutes').format('HH:mm:ss') : 'Not scheduled',
      statusEnabled: process.env.LOG_WEBHOOK_URL ? 'Yes' : 'No'
    };
    
    const embed = new EmbedBuilder()
      .setColor("#3498db")
      .setTitle("Bot Status Log")
      .setDescription(`**Current Bot Status**\nLast updated: ${moment().format('HH:mm:ss')}`)
      .addFields(
        { name: "Timezones Loaded", value: `${logInfo.timezonesLoaded} users`, inline: true },
        { name: "Storage", value: logInfo.storageType, inline: true },
        { name: "Guilds", value: `${logInfo.guildCount} servers`, inline: true },
        { name: "Uptime", value: logInfo.botUptime, inline: true },
        { name: "Memory Usage", value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true },
        { name: "Status Reports", value: logInfo.statusEnabled, inline: true },
        { name: "Next Status", value: logInfo.nextStatus, inline: true }
      )
      .setFooter({ text: "Unix Timestamp Bot Logs" })
      .setTimestamp();
    
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  
  if (command === "force-status") {
    // Manually trigger a status report
    await logger.sendStatusEmbed(client, storageReady, usingPersistentStorage, loadedSource, timezones);
    
    return interaction.reply({
      content: `Status report sent to logging channel. Next scheduled report in 30 minutes.`,
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
        value: `\`<t:${ts}:R>\`\n<t:${ts}:R>`, 
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

// Enhanced error logging
client.on("error", (error) => {
  if (logger) {
    logger.error(`Discord.js Client Error: ${error.message}`);
  } else {
    console.log(`Discord.js error: ${error.message}`);
  }
});

process.on("unhandledRejection", (error) => {
  if (logger) {
    logger.error(`Unhandled Promise Rejection: ${error.message}`);
  } else {
    console.log(`Unhandled promise rejection: ${error.message}`);
  }
});

process.on("uncaughtException", (error) => {
  if (logger) {
    logger.error(`Uncaught Exception: ${error.message}`);
  } else {
    console.log(`Uncaught exception: ${error.message}`);
  }
});

// Log bot status changes
client.on("guildCreate", (guild) => {
  if (logger) {
    logger.success(`Joined new guild: ${guild.name} (${guild.id}) - Members: ${guild.memberCount}`);
  }
});

client.on("guildDelete", (guild) => {
  if (logger) {
    logger.warn(`Left guild: ${guild.name} (${guild.id})`);
  }
});

// Clean up on exit
process.on('SIGINT', () => {
  if (logger) {
    logger.stopStatusSchedule();
    logger.info('Bot shutting down...');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (logger) {
    logger.stopStatusSchedule();
    logger.info('Bot shutting down...');
  }
  process.exit(0);
});

// Initialize everything
initializeStorage();
loadTimezones();

// Start bot
console.log("Connecting to Discord...");
client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.log(`Failed to login: ${error.message}`);
  process.exit(1);
});