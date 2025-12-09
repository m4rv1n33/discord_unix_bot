require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder().setName('unix-timestamp').setDescription('Get the current Unix timestamp'),
  new SlashCommandBuilder()
    .setName('unix-time')
    .setDescription('Convert a time/date to Unix timestamp')
    .addStringOption(option => option.setName('time').setDescription('Time in HH:mm').setRequired(true))
    .addStringOption(option => option.setName('date').setDescription('Optional date in YYYY-MM-DD').setRequired(false)),
  new SlashCommandBuilder()
    .setName('set-timezone')
    .setDescription('Set your timezone in GMT')
    .addStringOption(option => option.setName('timezone').setDescription('Your GMT offset (e.g., +2)').setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registering commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('Commands registered successfully!');
  } catch (error) {
    console.error(error);
  }
})();
