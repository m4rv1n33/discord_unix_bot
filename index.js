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
  return `<t:${ts}:t> – Short Time
<t:${ts}:T> – Long Time
<t:${ts}:d> – Short Date
<t:${ts}:D> – Long Date
<t:${ts}:f> – Short Date & Time
<t:${ts}:F> – Full Date & Time
<t:${ts}:R> – Relative Time`;
}

client.login(process.env.DISCORD_TOKEN);
