require('dotenv').config();
const { 
    Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits,
    Events, Partials, REST, Routes, SlashCommandBuilder
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageTyping
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ]
});

const TICKET_CHANNEL_ID = '1382458698005348393';
const LOG_CHANNEL_ID = '1382459063283220481';

async function sendLog(content, client) {
    try {
        const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel && logChannel.isTextBased()) {
            await logChannel.send(content);
        }
    } catch (error) {
        console.error('Errore invio log:', error);
    }
}

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} è online!`);
    await sendLog(`🤖 Bot avviato - ${new Date().toLocaleString()}`, client);

    const channel = client.channels.cache.get(TICKET_CHANNEL_ID);
    if (channel && channel.type === ChannelType.GuildText) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('Apri Ticket Generale')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫')
        );
        await channel.send({
            content: '**📂 Ticket Generali**\nPer qualsiasi altra domanda o segnalazione.',
            components: [row]
        });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton() && interaction.customId === 'create_ticket') {
        const modal = new ModalBuilder()
            .setCustomId('ticket_modal')
            .setTitle('📂 Apri un Ticket');

        const subjectInput = new TextInputBuilder()
            .setCustomId('ticket_subject')
            .setLabel("Motivo del ticket")
            .setPlaceholder("Descrivi brevemente il motivo")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const detailsInput = new TextInputBuilder()
            .setCustomId('ticket_details')
            .setLabel("Descrizione dettagliata")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const subjectRow = new ActionRowBuilder().addComponents(subjectInput);
        const detailsRow = new ActionRowBuilder().addComponents(detailsInput);

        modal.addComponents(subjectRow, detailsRow);
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal') {
        await interaction.deferReply({ ephemeral: true });

        const subject = interaction.fields.getTextInputValue('ticket_subject');
        const details = interaction.fields.getTextInputValue('ticket_details');
        const user = interaction.user;

        const category = interaction.guild.channels.cache.find(c => c.name === '🎫・Ticket Generale' && c.type === ChannelType.GuildCategory);
        if (!category) return await interaction.editReply('❌ Categoria "🎫・Ticket Generale" non trovata');

        const ticketChannel = await interaction.guild.channels.create({
            name: `ticket-${user.username}`,
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                { id: process.env.STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] }
            ]
        });

        const embed = {
            color: 0x5865F2,
            title: `📂 Ticket: ${subject}`,
            description: `**Da:** ${user}\n**Motivo:** ${subject}\n\n**Descrizione:**\n${details}`,
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

        await interaction.editReply({ content: `✅ Ticket creato: ${ticketChannel}`, ephemeral: true });
        await sendLog(`🎫 Nuovo ticket: ${ticketChannel} da ${user.tag}`, client);
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        if (!interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID)) {
            return await interaction.reply({ content: '❌ Solo lo staff può chiudere i ticket.', ephemeral: true });
        }

        const disabledButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Ticket Chiuso')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔒')
                .setDisabled(true)
        );

        await interaction.message.edit({ components: [disabledButton] });
        await interaction.channel.setName(`chiuso-${interaction.channel.name}`);
        await interaction.channel.permissionOverwrites.edit(interaction.guild.id, {
            ViewChannel: true,
            SendMessages: false
        });

        await interaction.reply({
            content: `🔒 Ticket chiuso da ${interaction.user}`
        });

        await sendLog(`🔒 **Ticket chiuso**\n> Chiuso da: ${interaction.user.tag}\n> Canale: ${interaction.channel}`, client);

        setTimeout(async () => {
            try {
                await interaction.channel.delete();
                await sendLog(`🗑️ **Ticket eliminato**\n> Eliminato da: ${interaction.user.tag}`, client);
            } catch (err) {
                console.error('Errore durante l\'eliminazione del canale:', err);
                await sendLog(`❌ **Errore eliminazione canale**:\n> Canale: ${interaction.channel.name}\n> Errore: ${err.message}`, client);
            }
        }, 5000);
    }

    // Slash Commands
    if (interaction.isChatInputCommand()) {
        const user = interaction.options.getUser('utente');

        if (!interaction.channel.name.startsWith('ticket-') && !interaction.channel.name.startsWith('chiuso-')) {
            return await interaction.reply({ content: '❌ Questo comando funziona solo nei canali ticket.', ephemeral: true });
        }

        if (interaction.commandName === 'aggiungi') {
            await interaction.channel.permissionOverwrites.edit(user.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });
            await interaction.reply(`✅ ${user} è stato aggiunto al ticket.`);
            await sendLog(`➕ ${user.tag} aggiunto al ticket da ${interaction.user.tag}`, client);
        }

        if (interaction.commandName === 'rimuovi') {
            await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: false });
            await interaction.reply(`✅ ${user} è stato rimosso dal ticket.`);
            await sendLog(`➖ ${user.tag} rimosso dal ticket da ${interaction.user.tag}`, client);
        }
    }
});

// Register slash commands (guild-specific)
const commands = [
    new SlashCommandBuilder()
        .setName('aggiungi')
        .setDescription('Aggiungi un utente al ticket')
        .addUserOption(option => option.setName('utente').setDescription('Utente da aggiungere').setRequired(true)),
    new SlashCommandBuilder()
        .setName('rimuovi')
        .setDescription('Rimuovi un utente dal ticket')
        .addUserOption(option => option.setName('utente').setDescription('Utente da rimuovere').setRequired(true))
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('📤 Registrazione comandi slash...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('✅ Comandi registrati!');
    } catch (err) {
        console.error('❌ Errore registrazione comandi:', err);
    }
})();

client.login(process.env.DISCORD_TOKEN);
