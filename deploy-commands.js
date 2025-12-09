const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('unix-timestamp')
    .setDescription('Get the current Unix timestamp'),

  new SlashCommandBuilder()
    .setName('unix-time')
    .setDescription('Convert a time/date to a Unix timestamp (example: 25-12-2025 14:30)')
    .addStringOption(option =>
      option
        .setName('time')
        .setDescription('Time in 24-hour format: HH:mm (example: 14:30)')
        .setRequired(true))
    .addStringOption(option =>
      option
        .setName('date')
        .setDescription('Optional date in dd-mm-yyyy format (example: 25-12-2025)')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('set-timezone')
    .setDescription('Set your timezone (e.g., Europe/Zurich or GMT+1)')
    .addStringOption(option =>
      option
        .setName('timezone')
        .setDescription('Your timezone (example: Europe/Zurich or GMT+1)')
        .setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Clearing old guild commands...');
    
    if (process.env.GUILD_ID) {
      // This clears all commands in the guild first
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: [] }
      );
      console.log('✅ Old guild commands cleared');
    }

    console.log('Registering commands globally...');
    // Register new global commands
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Commands registered globally');

  } catch (error) {
    console.error(error);
  }
})();
