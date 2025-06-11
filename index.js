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
    ChannelType,
    PermissionFlagsBits,
    Events,
    Partials
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

// ID dei canali importanti
const TICKET_CHANNEL_ID = '1382458698005348393';
const LOG_CHANNEL_ID = '1382459063283220481';

// Funzione per inviare log
async function sendLog(content, client) {
    try {
        const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel && logChannel.isTextBased()) {
            await logChannel.send(content);
        } else {
            console.error('Canale di log non trovato o non valido');
        }
    } catch (error) {
        console.error('Errore nell\'invio del log:', error);
    }
}

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} è online e pronto!`);
    await sendLog(`🤖 **Bot avviato** - ${new Date().toLocaleString()}`, client);
    
    // Invia il messaggio con il pulsante nel canale specificato
    const setupTicketPanel = async () => {
        const channel = client.channels.cache.get(TICKET_CHANNEL_ID);
        if (!channel || channel.type !== ChannelType.GuildText) {
            console.error(`❌ Canale con ID ${TICKET_CHANNEL_ID} non trovato!`);
            return;
        }

        try {
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
            await sendLog(`❌ **Errore setup pannello ticket**: ${error.message}`, client);
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
            .setDisabled(true);

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
                await interaction.editReply({
                    content: '❌ Categoria ticket non trovata! Crea una categoria chiamata "🎫・Ticket Generale"',
                    ephemeral: true
                });
                return;
            }

            // Crea il canale ticket
            const ticketChannel = await interaction.guild.channels.create({
                name: `ticket-${user.username}`,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    },
                    {
                        id: process.env.STAFF_ROLE_ID,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
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

            const message = await ticketChannel.send({
                content: `${user} | <@&${process.env.STAFF_ROLE_ID}>`,
                embeds: [embed],
                components: [closeButton]
            });

            await interaction.editReply({
                content: `✅ Ticket creato con successo: ${ticketChannel}`,
                ephemeral: true
            });

            // Log della creazione del ticket
            await sendLog(`🎫 **Nuovo ticket creato**\n> Creato da: ${user.tag}\n> Canale: ${ticketChannel}\n> Motivo: ${subject}`, client);
        } catch (error) {
            console.error('Errore creazione ticket:', error);
            await interaction.editReply({
                content: '❌ Errore nella creazione del ticket!',
                ephemeral: true
            });
            await sendLog(`❌ **Errore creazione ticket**:\n> Utente: ${user.tag}\n> Errore: ${error.message}`, client);
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
        
        // Log della chiusura
        await sendLog(`🔒 **Ticket chiuso**\n> Chiuso da: ${interaction.user.tag}\n> Canale: ${interaction.channel}`, client);
    }
});

// COMANDI PER AGGIUNGERE/RIMUOVERE UTENTI
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Verifica se il messaggio è in un ticket
    const isTicketChannel = message.channel.parent?.name === '🎫・Ticket Generale' && 
                            message.channel.name.startsWith('ticket-');
    
    if (!isTicketChannel) return;
    
    // Comando /aggiungi
    if (message.content.startsWith('/aggiungi')) {
        // Verifica permessi staff
        if (!message.member.roles.cache.has(process.env.STAFF_ROLE_ID)) {
            return message.reply('❌ Solo lo staff può aggiungere utenti ai ticket!');
        }
        
        const userToAdd = message.mentions.users.first();
        if (!userToAdd) {
            return message.reply('❌ Devi menzionare un utente da aggiungere!');
        }
        
        try {
            await message.channel.permissionOverwrites.create(userToAdd, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });
            
            await message.reply(`✅ ${userToAdd} è stato aggiunto al ticket!`);
            await sendLog(`👥 **Utente aggiunto al ticket**\n> Ticket: ${message.channel}\n> Aggiunto da: ${message.author.tag}\n> Utente: ${userToAdd.tag}`, client);
        } catch (error) {
            console.error('Errore aggiunta utente:', error);
            await message.reply('❌ Errore nell\'aggiungere l\'utente al ticket!');
            await sendLog(`❌ **Errore aggiunta utente**:\n> Ticket: ${message.channel}\n> Errore: ${error.message}`, client);
        }
    }
    
    // Comando /rimuovi
    if (message.content.startsWith('/rimuovi')) {
        // Verifica permessi staff
        if (!message.member.roles.cache.has(process.env.STAFF_ROLE_ID)) {
            return message.reply('❌ Solo lo staff può rimuovere utenti dai ticket!');
        }
        
        const userToRemove = message.mentions.users.first();
        if (!userToRemove) {
            return message.reply('❌ Devi menzionare un utente da rimuovere!');
        }
        
        try {
            await message.channel.permissionOverwrites.delete(userToRemove);
            await message.reply(`✅ ${userToRemove} è stato rimosso dal ticket!`);
            await sendLog(`👥 **Utente rimosso dal ticket**\n> Ticket: ${message.channel}\n> Rimosso da: ${message.author.tag}\n> Utente: ${userToRemove.tag}`, client);
        } catch (error) {
            console.error('Errore rimozione utente:', error);
            await message.reply('❌ Errore nella rimozione dell\'utente dal ticket!');
            await sendLog(`❌ **Errore rimozione utente**:\n> Ticket: ${message.channel}\n> Errore: ${error.message}`, client);
        }
    }
});

// LOG DELLE MODIFICHE AI MESSAGGI
client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    try {
        // Ignora messaggi di bot e messaggi non in ticket
        if (newMessage.author?.bot) return;
        
        const channel = newMessage.channel;
        const isTicketChannel = channel.parent?.name === '🎫・Ticket Generale' && 
                                channel.name.startsWith('ticket-');
        
        if (!isTicketChannel) return;
        
        // Evita log se il contenuto non è cambiato (es. embed aggiornati)
        if (oldMessage.content === newMessage.content) return;
        
        const logContent = `✏️ **Messaggio modificato** in ${channel}\n` +
                           `**Autore:** ${newMessage.author.tag} (${newMessage.author.id})\n` +
                           `**Vecchio contenuto:**\n${oldMessage.content?.substring(0, 1000) || '*Nessun contenuto testuale*'}\n` +
                           `**Nuovo contenuto:**\n${newMessage.content?.substring(0, 1000) || '*Nessun contenuto testuale*'}`;
        
        await sendLog(logContent, client);
    } catch (error) {
        console.error('Errore nel logging della modifica messaggio:', error);
    }
});

// LOG DEGLI ERRORI GLOBALI
process.on('unhandledRejection', async (reason) => {
    console.error('Unhandled Rejection:', reason);
    await sendLog(`⚠️ **Errore non gestito**:\n\`\`\`${reason}\`\`\``, client);
});

process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    await sendLog(`⚠️ **Eccezione non gestita**:\n\`\`\`${error.stack || error.message}\`\`\``, client);
});

client.on(Events.Error, async (error) => {
    console.error('Errore del client Discord:', error);
    await sendLog(`⚠️ **Errore del client Discord**:\n\`\`\`${error.stack || error.message}\`\`\``, client);
});

client.login(process.env.DISCORD_TOKEN);