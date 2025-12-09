require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.commandName;

  if (command === 'unix-timestamp') {
    const ts = Math.floor(Date.now() / 1000);
    return interaction.reply({ embeds: [buildTimestampEmbed(ts)] });
  }

  if (command === 'unix-time') {
    const time = interaction.options.getString('time');
    const date = interaction.options.getString('date') || new Date().toISOString().split('T')[0];

    const dateTime = new Date(`${date}T${time}`);
    if (isNaN(dateTime)) {
      return interaction.reply('❌ Invalid date or time format! Use HH:mm and YYYY-MM-DD.');
    }

    const ts = Math.floor(dateTime.getTime() / 1000);
    return interaction.reply({ embeds: [buildTimestampEmbed(ts)] });
  }

  if (command === 'set-timezone') {
    const tz = interaction.options.getString('timezone');
    return interaction.reply(`Timezone set to GMT${tz} (temporarily — not stored in MVP)`);
  }
});


// embed builder
function buildTimestampEmbed(ts) {
  return new EmbedBuilder()
    .setColor('#f200ff')
    .setTitle('Unix Time Converter')
    .addFields(
      { name: 'Short Time', value: `${render(ts, 't')} • \`<t:${ts}:t>\``, inline: false },
      { name: 'Long Time', value: `${render(ts, 'T')} • \`<t:${ts}:T>\``, inline: false },
      { name: 'Short Date', value: `${render(ts, 'd')} • \`<t:${ts}:d>\``, inline: false },
      { name: 'Long Date', value: `${render(ts, 'D')} • \`<t:${ts}:D>\``, inline: false },
      { name: 'Short Date & Time', value: `${render(ts, 'f')} • \`<t:${ts}:f>\``, inline: false },
      { name: 'Full Date & Time', value: `${render(ts, 'F')} • \`<t:${ts}:F>\``, inline: false },
      { name: 'Relative Time', value: `${render(ts, 'R')} • \`<t:${ts}:R>\``, inline: false }
    )
    .setFooter({ text: `Made by @m4rv1n_33` });
}

function render(ts, style) {
  return `<t:${ts}:${style}>`;
}

// bot token login
client.login(process.env.DISCORD_TOKEN);
