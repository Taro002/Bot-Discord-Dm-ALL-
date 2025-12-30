const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

// BASIC CONFIG
const TOKEN = "YOUR_BOT_TOKEN";
const PREFIX = "+";
const DELAY_MS = 1500;

client.once(Events.ClientReady, () => {
  console.log(`Bot logged in as ${client.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(`${PREFIX}message`)) return;

  await message.reply("Send the message you want to DM to all members.");

  const filter = (m) => m.author.id === message.author.id;
  const collected = await message.channel.awaitMessages({
    filter,
    max: 1,
    time: 60000,
  });

  if (!collected.size) {
    return message.reply("Command timed out.");
  }

  const content = collected.first().content;

  const previewEmbed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle("Message Preview")
    .setDescription(content)
    .setFooter({ text: "Confirm or cancel" });

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("confirm_send")
      .setLabel("Send")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("cancel_send")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger)
  );

  const previewMessage = await message.reply({
    embeds: [previewEmbed],
    components: [buttons],
  });

  const collector = previewMessage.createMessageComponentCollector({
    filter: (i) =>
      i.user.id === message.author.id &&
      ["confirm_send", "cancel_send"].includes(i.customId),
    time: 60000,
  });

  collector.on("collect", async (interaction) => {
    if (interaction.customId === "cancel_send") {
      await interaction.update({
        content: "Operation cancelled.",
        embeds: [],
        components: [],
      });
      return collector.stop();
    }

    await interaction.update({
      content: "Sending messages...",
      embeds: [],
      components: [],
    });

    const guild = message.guild;
    await guild.members.fetch();

    const members = guild.members.cache.filter((m) => !m.user.bot);

    let success = 0;
    let failed = 0;

    const status = await message.channel.send("Starting DM broadcast...");

    for (const member of members.values()) {
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setDescription(content);

        await member.send({ embeds: [dmEmbed] });
        success++;
      } catch {
        failed++;
      }

      if ((success + failed) % 5 === 0) {
        await status.edit(
          `Progress: ${success} sent / ${failed} failed`
        );
      }

      await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    await status.edit(
      `Done. ${success} messages sent. ${failed} failed.`
    );

    collector.stop();
  });

  collector.on("end", async (_, reason) => {
    if (reason === "time") {
      await previewMessage.edit({
        content: "Command expired.",
        embeds: [],
        components: [],
      });
    }
  });
});

client.login(TOKEN);
