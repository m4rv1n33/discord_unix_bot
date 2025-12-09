require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.commandName;

  if (command === 'unix-timestamp') {
    const ts = Math.floor(Date.now() / 1000);
    await interaction.reply(formatTimestamps(ts));
  } 
  else if (command === 'unix-time') {
    const time = interaction.options.getString('time');
    const date = interaction.options.getString('date') || new Date().toISOString().split('T')[0];
    const dateTime = new Date(`${date}T${time}`);
    if (isNaN(dateTime)) return interaction.reply('Invalid date or time!');
    const ts = Math.floor(dateTime.getTime() / 1000);
    await interaction.reply(formatTimestamps(ts));
  } 
  else if (command === 'set-timezone') {
    const tz = interaction.options.getString('timezone');
    await interaction.reply(`Timezone set to GMT${tz} (doesn't persist and work as intended yet).`);
  }
});

function formatTimestamps(ts) {
  return `${render(ts, 't')} - \`<t:${ts}:t>\` - Short Time
${render(ts, 'T')} - \`<t:${ts}:T>\` - Long Time
${render(ts, 'd')} - \`<t:${ts}:d>\` - Short Date
${render(ts, 'D')} - \`<t:${ts}:D>\` - Long Date
${render(ts, 'f')} - \`<t:${ts}:f>\` - Short Date & Time
${render(ts, 'F')} - \`<t:${ts}:F>\` - Full Date & Time
${render(ts, 'R')} - \`<t:${ts}:R>\` - Relative Time`;
}

function render(ts, style) {
  return `<t:${ts}:${style}>`;
}


client.login(process.env.DISCORD_TOKEN);
