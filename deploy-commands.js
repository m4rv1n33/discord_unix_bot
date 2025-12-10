const { REST, Routes, SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType, PermissionsBitField } = require('discord.js');

// Define regular slash commands
const slashCommands = [
  new SlashCommandBuilder()
    .setName('unix-timestamp')
    .setDescription('Get the current Unix timestamp')
    .setIntegrationTypes([ ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall ]),

  new SlashCommandBuilder()
    .setName('unix-time')
    .setDescription('Convert a time/date to a Unix timestamp')
    .setIntegrationTypes([ ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall ])
    .addStringOption(option =>
      option
        .setName('time')
        .setDescription('Time in 24-hour format: HH:mm (example: 14:30)')
        .setRequired(true)
        .setMinLength(5)
        .setMaxLength(5))
    .addStringOption(option =>
      option
        .setName('date')
        .setDescription('Optional date in dd-mm-yyyy format (example: 25-12-2025)')
        .setRequired(false)
        .setMinLength(10)
        .setMaxLength(10)),

  new SlashCommandBuilder()
    .setName('set-timezone')
    .setDescription('Set your timezone (e.g., Europe/Zurich)')
    .setIntegrationTypes([ ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall ])
    .addStringOption(option =>
      option
        .setName('timezone')
        .setDescription('IANA timezone (example: Europe/Zurich, America/New_York)')
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(50)),

  new SlashCommandBuilder()
    .setName('storage-status')
    .setDescription('[Admin] Check bot storage status')
    .setIntegrationTypes([ ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall ])
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator), // Admin only

  new SlashCommandBuilder()
    .setName('backup-timezones')
    .setDescription('[Admin] Download timezone data backup')
    .setIntegrationTypes([ ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall ])
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator) // Admin only

].map(cmd => cmd.toJSON());

// Define Context Menu Commands (User Commands)
const contextMenuCommands = [
  new ContextMenuCommandBuilder()
    .setName('Get Unix Timestamp')
    .setType(ApplicationCommandType.User),
    
  new ContextMenuCommandBuilder()
    .setName('Set Timezone for User')
    .setType(ApplicationCommandType.User)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator), // Admin only
].map(cmd => cmd.toJSON());

// Combine all commands
const allCommands = [...slashCommands, ...contextMenuCommands];

// Validate environment variables
function validateEnv() {
  const required = ['DISCORD_TOKEN', 'CLIENT_ID'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error(`❌ Missing environment variables: ${missing.join(', ')}`);
    console.error('Please set these in your Railway environment variables');
    return false;
  }
  
  console.log('✅ Environment variables validated');
  return true;
}

async function deployCommands() {
  console.log('🚀 Starting command deployment...');
  
  // Validate env
  if (!validateEnv()) {
    process.exit(1);
  }
  
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const clientId = process.env.CLIENT_ID;
  
  try {
    // Deploy to specific guild (for testing)
    if (process.env.GUILD_ID) {
      console.log(`🔧 Deploying to guild: ${process.env.GUILD_ID}`);
      
      // Clear existing guild commands first
      await rest.put(
        Routes.applicationGuildCommands(clientId, process.env.GUILD_ID),
        { body: [] }
      );
      console.log('✅ Cleared old guild commands');
      
      // Register new guild commands
      const guildData = await rest.put(
        Routes.applicationGuildCommands(clientId, process.env.GUILD_ID),
        { body: allCommands }
      );
      console.log(`✅ Registered ${guildData.length} commands to guild`);
    }
    
    // Deploy globally
    console.log('🌍 Deploying global commands...');
    const globalData = await rest.put(
      Routes.applicationCommands(clientId),
      { body: allCommands }
    );
    
    console.log(`✅ Registered ${globalData.length} commands globally`);
    console.log('\n📋 Command List:');
    
    // Count by type and permissions
    const slashCmds = globalData.filter(c => c.type === 1);
    const userCmds = globalData.filter(c => c.type === 2);
    
    console.log(`Slash Commands (${slashCmds.length}):`);
    slashCmds.forEach(cmd => {
      const isAdmin = cmd.default_member_permissions === '8';
      console.log(`   /${cmd.name} - ${cmd.description} ${isAdmin ? '🔐' : ''}`);
    });
    
    console.log(`\nUser Commands (${userCmds.length}):`);
    userCmds.forEach(cmd => {
      const isAdmin = cmd.default_member_permissions === '8';
      console.log(`   ${cmd.name} - Right-click user ${isAdmin ? '🔐' : ''}`);
    });
    
    console.log('\n🎉 Deployment complete!');
    console.log('🔐 Admin-only commands marked with 🔐');
    console.log('⚠️  Global commands may take up to 1 hour to appear');
    
  } catch (error) {
    console.error('💥 Deployment failed:', error.message);
    process.exit(1);
  }
}

// Run deployment
deployCommands();