require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes, ChannelType } = require('discord.js');
const db = require('./database');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages] });

client.commands = new Collection();

// Importa tutti i comandi
const commands = require('./commands');
client.commands = commands;

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// Ruoli autorizzati
const STAFF_ROLE = process.env.STAFF_ROLE || 'Staff LSPD';
const PULISCI_FEDINA_ROLE = process.env.PULISCI_FEDINA_ROLE || 'Comandante';

client.on('ready', async () => {
  console.log(`✅ Bot online come ${client.user.tag}`);
  
  // Registra i comandi slash
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const commandData = Object.values(commands).map(cmd => cmd.data.toJSON());
  
  try {
    console.log('📝 Registrazione comandi slash...');
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commandData });
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commandData });
    }
    console.log('✅ Comandi registrati con successo');
  } catch (error) {
    console.error('❌ Errore nella registrazione dei comandi:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    const command = client.commands[interaction.commandName];
    
    if (!command) return;
    
    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(error);
      const errorMessage = { content: '❌ C\'è stato un errore nell\'esecuzione del comando!', ephemeral: true };
      if (interaction.replied) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
  
  if (interaction.isButton()) {
    const [action, userId] = interaction.customId.split('_');
    
    if (action === 'timbra') {
      if (interaction.user.id !== userId && !interaction.member?.roles.cache.has(STAFF_ROLE)) {
        return interaction.reply({ content: '❌ Non puoi usare i bottoni di altri agenti!', ephemeral: true });
      }
      
      const agente = db.getAgente(userId);
      if (!agente) db.addAgente(userId, interaction.user.username);
      
      db.updateAgente(userId, {
        inServizio: true,
        timbraInizio: new Date().toISOString()
      });
      
      await interaction.reply({ content: `✅ Timbratura entrata registrata alle ${new Date().toLocaleTimeString('it-IT')}`, ephemeral: true });
    }
    
    if (action === 'stimbra') {
      if (interaction.user.id !== userId && !interaction.member?.roles.cache.has(STAFF_ROLE)) {
        return interaction.reply({ content: '❌ Non puoi usare i bottoni di altri agenti!', ephemeral: true });
      }
      
      const agente = db.getAgente(userId);
      if (!agente || !agente.inServizio) {
        return interaction.reply({ content: '⚠️ Non sei in servizio!', ephemeral: true });
      }
      
      const inizio = new Date(agente.timbraInizio);
      const fine = new Date();
      const ore = (fine - inizio) / (1000 * 60 * 60);
      
      db.updateAgente(userId, {
        inServizio: false,
        timbraInizio: null,
        oreServizio: agente.oreServizio + ore,
        oreTotali: agente.oreTotali + ore
      });
      
      await interaction.reply({ content: `✅ Timbratura uscita registrata. Ore lavorate: ${ore.toFixed(2)}h`, ephemeral: true });
    }
    
    if (action === 'stat') {
      const agente = db.getAgente(userId);
      if (!agente) {
        return interaction.reply({ content: '⚠️ Nessun dato trovato!', ephemeral: true });
      }
      
      const embed = {
        color: 0x0099ff,
        title: `📊 Statistiche - ${agente.nome}`,
        fields: [
          { name: 'Ore Totali', value: `${agente.oreTotali.toFixed(2)}h`, inline: true },
          { name: 'Stato', value: agente.inServizio ? '🟢 In Servizio' : '⚫ Fuori Servizio', inline: true },
          { name: 'PDA Emessi', value: `${agente.pdaEmessi}`, inline: true },
          { name: 'Arresti', value: `${agente.arresti}`, inline: true },
          { name: 'Multe', value: `${agente.multe}`, inline: true },
          { name: 'Sequestri', value: `${agente.sequestri}`, inline: true }
        ]
      };
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    if (action === 'stato') {
      const agente = db.getAgente(userId);
      if (!agente) {
        return interaction.reply({ content: '⚠️ Nessun dato trovato!', ephemeral: true });
      }
      
      const status = agente.inServizio ? '🟢 **IN SERVIZIO**' : '⚫ **FUORI SERVIZIO**';
      await interaction.reply({ content: status, ephemeral: true });
    }
  }
});

client.login(TOKEN);
