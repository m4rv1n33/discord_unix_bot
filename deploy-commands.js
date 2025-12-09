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
    console.log('Registering commands...');

    // --- Optional: Guild-specific registration (instant, for testing) ---
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands }
      );
      console.log('✅ Commands registered in guild (test server)');
    }

    // --- Global registration (all servers, may take up to 1 hour) ---
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Commands registered globally');

  } catch (error) {
    console.error(error);
  }
})();
