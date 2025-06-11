require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle,
  ChannelType
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ]
});

// ID del canale dove mostrare il pulsante
const TICKET_CHANNEL_ID = '1382458698005348393';

client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} è online e pronto!`);
  
  // Invia il messaggio con il pulsante nel canale specificato
  const setupTicketPanel = async () => {
    const channel = client.channels.cache.get(TICKET_CHANNEL_ID);
    if (!channel || channel.type !== ChannelType.GuildText) {
      console.error(`❌ Canale con ID ${TICKET_CHANNEL_ID} non trovato o non è un canale testuale!`);
      return;
    }

    try {
      // Cancella eventuali messaggi precedenti del bot
      const messages = await channel.messages.fetch();
      messages.forEach(msg => {
        if (msg.author.id === client.user.id) msg.delete().catch(console.error);
      });

      // Crea il pulsante per aprire i ticket
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('Apri Ticket Generale')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎫')
      );

      // Invia il messaggio con il pulsante
      await channel.send({
        content: '**📂 Ticket Generali**\nPer qualsiasi altra domanda o segnalazione.',
        components: [row]
      });
      console.log(`Pannello ticket creato nel canale ${channel.name}`);
    } catch (error) {
      console.error('Errore nella creazione del pannello ticket:', error);
    }
  };

  await setupTicketPanel();
});

// Gestione del pulsante ticket
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  
  if (interaction.customId === 'create_ticket') {
    // Crea il modal con la descrizione richiesta
    const modal = new ModalBuilder()
      .setCustomId('ticket_modal')
      .setTitle('📂 Ticket Generali');

    // Descrizione fissa come richiesto
    const descriptionInput = new TextInputBuilder()
      .setCustomId('ticket_info')
      .setLabel("Informazioni")
      .setValue("Per qualsiasi altra domanda o segnalazione.")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setDisabled(true); // Campo non modificabile

    // Campo per il motivo del ticket
    const subjectInput = new TextInputBuilder()
      .setCustomId('ticket_subject')
      .setLabel("Motivo del ticket")
      .setPlaceholder("Descrivi brevemente il motivo")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    // Campo per la descrizione dettagliata
    const detailsInput = new TextInputBuilder()
      .setCustomId('ticket_details')
      .setLabel("Descrizione dettagliata")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const firstRow = new ActionRowBuilder().addComponents(descriptionInput);
    const secondRow = new ActionRowBuilder().addComponents(subjectInput);
    const thirdRow = new ActionRowBuilder().addComponents(detailsInput);

    modal.addComponents(firstRow, secondRow, thirdRow);
    await interaction.showModal(modal);
  }
});

// Gestione della sottomissione del modal
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  
  if (interaction.customId === 'ticket_modal') {
    await interaction.deferReply({ ephemeral: true });
    
    const subject = interaction.fields.getTextInputValue('ticket_subject');
    const details = interaction.fields.getTextInputValue('ticket_details');
    const user = interaction.user;

    try {
      // Trova la categoria ticket
      const category = interaction.guild.channels.cache.find(
        c => c.name === '🎫・Ticket Generale' && c.type === ChannelType.GuildCategory
      );

      if (!category) {
        return interaction.editReply({
          content: '❌ Categoria ticket non trovata! Crea una categoria chiamata "🎫・Ticket Generale"',
          ephemeral: true
        });
      }

      // Crea il canale ticket
      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${user.username}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: ['ViewChannel']
          },
          {
            id: user.id,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
          },
          {
            id: process.env.STAFF_ROLE_ID,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages']
          }
        ]
      });

      // Invia il messaggio nel ticket
      const embed = {
        color: 0x5865F2,
        title: `📂 Ticket Generale: ${subject}`,
        description: `**Creato da:** ${user}\n**Motivo:** ${subject}\n\n**Descrizione:**\n${details}`,
        footer: { text: 'Supporto Generale' }
      };

      const closeButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('Chiudi Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
      );

      await ticketChannel.send({
        content: `${user} | <@&${process.env.STAFF_ROLE_ID}>`,
        embeds: [embed],
        components: [closeButton]
      });

      await interaction.editReply({
        content: `✅ Ticket creato con successo: ${ticketChannel}`,
        ephemeral: true
      });

    } catch (error) {
      console.error('Errore creazione ticket:', error);
      await interaction.editReply({
        content: '❌ Errore nella creazione del ticket!',
        ephemeral: true
      });
    }
  }
  
  // Gestione chiusura ticket
  if (interaction.isButton() && interaction.customId === 'close_ticket') {
    if (!interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID)) {
      return interaction.reply({
        content: '❌ Solo lo staff può chiudere i ticket!',
        ephemeral: true
      });
    }
    
    // Disabilita il pulsante di chiusura
    const disabledButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('Ticket Chiuso')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔒')
        .setDisabled(true)
    );
    
    await interaction.message.edit({ components: [disabledButton] });
    
    // Rinomina e archivia il ticket
    await interaction.channel.setName(`chiuso-${interaction.channel.name}`);
    await interaction.channel.permissionOverwrites.edit(interaction.guild.id, {
      ViewChannel: true,
      SendMessages: false
    });
    
    await interaction.reply({
      content: `🔒 Ticket chiuso da ${interaction.user}`
    });
  }
});

client.login(process.env.DISCORD_TOKEN);