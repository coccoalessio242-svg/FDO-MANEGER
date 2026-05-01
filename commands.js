const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const db = require('./database');

const STAFF_ROLE = process.env.STAFF_ROLE || 'Staff LSPD';
const PULISCI_FEDINA_ROLE = process.env.PULISCI_FEDINA_ROLE || 'Comandante';

function hasRole(member, roleName) {
  if (!member) return false;
  return member.roles.cache.some(role => role.name === roleName || role.id === roleName);
}

function createInfoPersonaEmbed(persona) {
  const embed = new EmbedBuilder()
    .setColor(persona.fedina === 'pulita' ? 0x00ff00 : 0xff0000)
    .setTitle(`👤 ${persona.nome} ${persona.cognome}`)
    .setFields([
      { name: 'Data di Nascita', value: persona.dataNascita, inline: true },
      { name: 'Fedina', value: persona.fedina === 'pulita' ? '✅ PULITA' : '🚨 SPORCA', inline: true },
      { name: '\u200b', value: '\u200b' },
    ]);
  
  if (persona.arresti.length > 0) {
    embed.addFields({
      name: '🚔 Arresti',
      value: persona.arresti.map(arrestId => {
        const arr = db.getArresto(arrestId);
        return `[ID: ${arrestId}] - ${arr.reati} (${new Date(arr.data).toLocaleDateString('it-IT')})`;
      }).join('\n'),
      inline: false
    });
  }
  
  if (persona.macchineSequestrate.length > 0) {
    embed.addFields({
      name: '🚗 Macchine Sequestrate',
      value: persona.macchineSequestrate.map(m => `Targa: ${m.targa}`).join('\n'),
      inline: false
    });
  }
  
  if (persona.denuncie.length > 0) {
    embed.addFields({
      name: '📋 Denuncie',
      value: persona.denuncie.map(denId => {
        const den = db.getDenuncia(denId);
        return `[ID: ${denId}] - ${den.reati}`;
      }).join('\n'),
      inline: false
    });
  }
  
  if (persona.multe.length > 0) {
    embed.addFields({
      name: '💰 Multe',
      value: persona.multe.map(multaId => {
        const multa = db.getMulta(multaId);
        return `[ID: ${multaId}] - ${multa.reato}`;
      }).join('\n'),
      inline: false
    });
  }
  
  if (persona.pda) {
    const pdaInfo = db.getPda(persona.pda);
    embed.addFields({
      name: '🔫 Porto d\'Armi (PDA)',
      value: `Scadenza: ${pdaInfo.dataScadenza}`,
      inline: false
    });
  }
  
  return embed;
}

const commands = {
  timbratura: {
    data: new SlashCommandBuilder()
      .setName('timbratura')
      .setDescription('Apre il cartellino di timbratura LSPD')
      .addUserOption(option => 
        option.setName('agente').setDescription('Agente (default: te stesso)').setRequired(false)
      ),
    execute: async (interaction) => {
      const agente = interaction.options.getUser('agente') || interaction.user;
      const agenteId = agente.id;
      
      if (agente.id !== interaction.user.id && !hasRole(interaction.member, STAFF_ROLE)) {
        return interaction.reply({ content: '❌ Solo lo staff può visualizzare i cartellini di altri agenti!', ephemeral: true });
      }
      
      let agenteData = db.getAgente(agenteId);
      if (!agenteData) {
        db.addAgente(agenteId, agente.username);
        agenteData = db.getAgente(agenteId);
      }
      
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`🚔 CARTELLINO LSPD - ${agenteData.nome}`)
        .setDescription('**SALVE AGENTE LSPD**\n\nPER TIMBRARE IL TUO SERVIZIO USA QUESTI BOTTONI:\n\n' +
          '🟢 **Timbra** - Inizia il servizio (registra ora di inizio)\n' +
          '🔴 **Stimbra** - Termina il servizio (registra ore lavorate)\n' +
          '📊 **Statistiche** - Visualizza le tue ore totali e statistiche\n' +
          '⚫ **Stato** - Visualizza lo stato attuale del servizio')
        .setFields([
          { name: 'Ore Totali', value: `${agenteData.oreTotali.toFixed(2)}h`, inline: true },
          { name: 'Stato', value: agenteData.inServizio ? '🟢 IN SERVIZIO' : '⚫ FUORI SERVIZIO', inline: true },
          { name: '\u200b', value: '\u200b' }
        ])
        .setFooter({ text: `ID: ${agenteId}` });
      
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`timbra_${agenteId}`)
            .setLabel('Timbra')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🟢'),
          new ButtonBuilder()
            .setCustomId(`stimbra_${agenteId}`)
            .setLabel('Stimbra')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔴'),
          new ButtonBuilder()
            .setCustomId(`stat_${agenteId}`)
            .setLabel('Statistiche')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📊'),
          new ButtonBuilder()
            .setCustomId(`stato_${agenteId}`)
            .setLabel('Stato')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⚫')
        );
      
      await interaction.reply({ embeds: [embed], components: [row] });
    }
  },

  aggiungi_ore: {
    data: new SlashCommandBuilder()
      .setName('aggiungi_ore')
      .setDescription('[STAFF] Aggiungi ore a un agente')
      .addUserOption(option => option.setName('agente').setDescription('Agente').setRequired(true))
      .addNumberOption(option => option.setName('ore').setDescription('Numero di ore').setRequired(true)),
    execute: async (interaction) => {
      if (!hasRole(interaction.member, STAFF_ROLE)) {
        return interaction.reply({ content: '❌ Solo lo staff può usare questo comando!', ephemeral: true });
      }
      
      const agente = interaction.options.getUser('agente');
      const ore = interaction.options.getNumber('ore');
      
      let agenteData = db.getAgente(agente.id);
      if (!agenteData) db.addAgente(agente.id, agente.username);
      
      agenteData = db.getAgente(agente.id);
      db.updateAgente(agente.id, {
        oreServizio: agenteData.oreServizio + ore,
        oreTotali: agenteData.oreTotali + ore
      });
      
      await interaction.reply({ content: `✅ Aggiunte ${ore}h all'agente ${agente.username}`, ephemeral: true });
    }
  },

  forza_stop: {
    data: new SlashCommandBuilder()
      .setName('forza_stop')
      .setDescription('[STAFF] Forza stop del servizio di un agente')
      .addUserOption(option => option.setName('agente').setDescription('Agente').setRequired(true)),
    execute: async (interaction) => {
      if (!hasRole(interaction.member, STAFF_ROLE)) {
        return interaction.reply({ content: '❌ Solo lo staff può usare questo comando!', ephemeral: true });
      }
      
      const agente = interaction.options.getUser('agente');
      const agenteData = db.getAgente(agente.id);
      
      if (!agenteData || !agenteData.inServizio) {
        return interaction.reply({ content: '⚠️ L\'agente non è in servizio!', ephemeral: true });
      }
      
      const inizio = new Date(agenteData.timbraInizio);
      const fine = new Date();
      const ore = (fine - inizio) / (1000 * 60 * 60);
      
      db.updateAgente(agente.id, {
        inServizio: false,
        timbraInizio: null,
        oreServizio: agenteData.oreServizio + ore,
        oreTotali: agenteData.oreTotali + ore
      });
      
      await interaction.reply({ content: `✅ Servizio forzatamente terminato. Ore: ${ore.toFixed(2)}h`, ephemeral: true });
    }
  },

  info_agente: {
    data: new SlashCommandBuilder()
      .setName('info_agente')
      .setDescription('[STAFF] Visualizza info di un agente')
      .addUserOption(option => option.setName('agente').setDescription('Agente').setRequired(true)),
    execute: async (interaction) => {
      if (!hasRole(interaction.member, STAFF_ROLE)) {
        return interaction.reply({ content: '❌ Solo lo staff può usare questo comando!', ephemeral: true });
      }
      
      const agente = interaction.options.getUser('agente');
      const agenteData = db.getAgente(agente.id);
      
      if (!agenteData) {
        return interaction.reply({ content: '⚠️ Agente non trovato!', ephemeral: true });
      }
      
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`👮 ${agenteData.nome}`)
        .setFields([
          { name: 'Ore Cartellino', value: `${agenteData.oreServizio.toFixed(2)}h`, inline: true },
          { name: 'Ore Totali', value: `${agenteData.oreTotali.toFixed(2)}h`, inline: true },
          { name: 'Stato', value: agenteData.inServizio ? '🟢 In Servizio' : '⚫ Fuori Servizio', inline: true },
          { name: 'PDA Emessi', value: `${agenteData.pdaEmessi}`, inline: true },
          { name: 'Arresti', value: `${agenteData.arresti}`, inline: true },
          { name: 'Multe', value: `${agenteData.multe}`, inline: true },
          { name: 'Sequestri', value: `${agenteData.sequestri}`, inline: true }
        ]);
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },

  arresto: {
    data: new SlashCommandBuilder()
      .setName('arresto')
      .setDescription('Registra un arresto')
      .addStringOption(option => option.setName('nome').setDescription('Nome arrestato').setRequired(true))
      .addStringOption(option => option.setName('cognome').setDescription('Cognome arrestato').setRequired(true))
      .addStringOption(option => option.setName('data_nascita').setDescription('Data di nascita (GG/MM/YYYY)').setRequired(true))
      .addStringOption(option => option.setName('reati').setDescription('Reati imputati').setRequired(true))
      .addNumberOption(option => option.setName('multa').setDescription('Importo multa').setRequired(true))
      .addStringOption(option => option.setName('oggetti_sequestrati').setDescription('Oggetti sequestrati').setRequired(true))
      .addStringOption(option => option.setName('oggetti_consegnati').setDescription('Oggetti consegnati').setRequired(true))
      .addStringOption(option => option.setName('foto').setDescription('URL foto (obbligatorio)').setRequired(true))
      .addUserOption(option => option.setName('agenti').setDescription('Agenti coinvolti (tag con spazi)').setRequired(false)),
    execute: async (interaction) => {
      const nome = interaction.options.getString('nome');
      const cognome = interaction.options.getString('cognome');
      const dataNascita = interaction.options.getString('data_nascita');
      const reati = interaction.options.getString('reati');
      const multa = interaction.options.getNumber('multa');
      const oggettiSequestrati = interaction.options.getString('oggetti_sequestrati');
      const oggettiConsegnati = interaction.options.getString('oggetti_consegnati');
      const foto = interaction.options.getString('foto');
      
      const agentiMenzionati = interaction.mentions.users.map(u => u.id) || [interaction.user.id];
      
      const arrestId = db.addArresto(
        agentiMenzionati,
        nome,
        cognome,
        dataNascita,
        reati,
        multa,
        oggettiSequestrati,
        oggettiConsegnati,
        foto
      );
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`🚔 ARRESTO REGISTRATO`)
        .setThumbnail(foto)
        .setDescription(`**Arrestato:** ${nome} ${cognome}`)
        .setFields([
          { name: '🆔 ID Arresto', value: `\`${arrestId}\``, inline: true },
          { name: '📅 Data Nascita', value: `\`${dataNascita}\``, inline: true },
          { name: '\u200b', value: '\u200b' },
          { name: '⚖️ Reati Imputati', value: `\`\`\`${reati}\`\`\``, inline: false },
          { name: '💰 Multa', value: `\`€${multa.toFixed(2)}\``, inline: true },
          { name: '📅 Data Arresto', value: `\`${new Date().toLocaleDateString('it-IT')}\``, inline: true },
          { name: '\u200b', value: '\u200b' },
          { name: '🔒 Oggetti Sequestrati', value: `\`\`\`${oggettiSequestrati}\`\`\``, inline: false },
          { name: '📦 Oggetti Consegnati', value: `\`\`\`${oggettiConsegnati}\`\`\``, inline: false },
          { name: '\u200b', value: '\u200b' },
          { name: '👮 Registrato da', value: `\`${interaction.user.username}\``, inline: true },
          { name: '⏰ Ora', value: `\`${new Date().toLocaleTimeString('it-IT')}\``, inline: true }
        ])
        .setFooter({ text: 'LSPD Database System', iconURL: 'https://cdn.discordapp.com/emojis/1234567890.png' })
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
    }
  },

  edit_arresto: {
    data: new SlashCommandBuilder()
      .setName('edit_arresto')
      .setDescription('Modifica un arresto')
      .addIntegerOption(option => option.setName('id').setDescription('ID dell\'arresto').setRequired(true))
      .addStringOption(option => option.setName('reati').setDescription('Reati').setRequired(false))
      .addNumberOption(option => option.setName('multa').setDescription('Multa').setRequired(false))
      .addStringOption(option => option.setName('oggetti_sequestrati').setDescription('Oggetti sequestrati').setRequired(false))
      .addStringOption(option => option.setName('oggetti_consegnati').setDescription('Oggetti consegnati').setRequired(false)),
    execute: async (interaction) => {
      const id = interaction.options.getInteger('id');
      const arresto = db.getArresto(id);
      
      if (!arresto) {
        return interaction.reply({ content: '❌ Arresto non trovato!', ephemeral: true });
      }
      
      const updates = {};
      if (interaction.options.getString('reati')) updates.reati = interaction.options.getString('reati');
      if (interaction.options.getNumber('multa') !== null) updates.multa = interaction.options.getNumber('multa');
      if (interaction.options.getString('oggetti_sequestrati')) updates.oggettiSequestrati = interaction.options.getString('oggetti_sequestrati');
      if (interaction.options.getString('oggetti_consegnati')) updates.oggettiConsegnati = interaction.options.getString('oggetti_consegnati');
      
      db.editArresto(id, updates);
      
      await interaction.reply({ content: `✅ Arresto #${id} modificato con successo!`, ephemeral: true });
    }
  },

  rilascia_pda: {
    data: new SlashCommandBuilder()
      .setName('rilascia_pda')
      .setDescription('Rilascia un porto d\'armi (PDA)')
      .addStringOption(option => option.setName('nome').setDescription('Nome').setRequired(true))
      .addStringOption(option => option.setName('cognome').setDescription('Cognome').setRequired(true))
      .addStringOption(option => option.setName('data_nascita').setDescription('Data di nascita (GG/MM/YYYY)').setRequired(true))
      .addStringOption(option => option.setName('motivo').setDescription('Motivo del rilascio').setRequired(true))
      .addStringOption(option => option.setName('data_scadenza').setDescription('Data scadenza (GG/MM/YYYY)').setRequired(true)),
    execute: async (interaction) => {
      const nome = interaction.options.getString('nome');
      const cognome = interaction.options.getString('cognome');
      const dataNascita = interaction.options.getString('data_nascita');
      const motivo = interaction.options.getString('motivo');
      const dataScadenza = interaction.options.getString('data_scadenza');
      
      const pdaId = db.addPda(interaction.user.id, nome, cognome, dataNascita, motivo, dataScadenza);
      
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(`🔫 PDA RILASCIATO`)
        .setFields([
          { name: 'ID PDA', value: `${pdaId}`, inline: true },
          { name: 'Persona', value: `${nome} ${cognome}`, inline: true },
          { name: 'Data Nascita', value: dataNascita, inline: true },
          { name: 'Motivo', value: motivo, inline: false },
          { name: 'Scadenza', value: dataScadenza, inline: true },
          { name: 'Rilasciato da', value: interaction.user.username, inline: true }
        ]);
      
      await interaction.reply({ embeds: [embed] });
    }
  },

  edit_pda: {
    data: new SlashCommandBuilder()
      .setName('edit_pda')
      .setDescription('Modifica un PDA')
      .addIntegerOption(option => option.setName('id').setDescription('ID del PDA').setRequired(true))
      .addStringOption(option => option.setName('motivo').setDescription('Motivo').setRequired(false))
      .addStringOption(option => option.setName('data_scadenza').setDescription('Data scadenza').setRequired(false)),
    execute: async (interaction) => {
      const id = interaction.options.getInteger('id');
      const pda = db.getPda(id);
      
      if (!pda) {
        return interaction.reply({ content: '❌ PDA non trovato!', ephemeral: true });
      }
      
      const updates = {};
      if (interaction.options.getString('motivo')) updates.motivo = interaction.options.getString('motivo');
      if (interaction.options.getString('data_scadenza')) updates.dataScadenza = interaction.options.getString('data_scadenza');
      
      db.editPda(id, updates);
      
      await interaction.reply({ content: `✅ PDA #${id} modificato con successo!`, ephemeral: true });
    }
  },

  ritira_pda: {
    data: new SlashCommandBuilder()
      .setName('ritira_pda')
      .setDescription('Ritira un porto d\'armi (PDA)')
      .addStringOption(option => option.setName('nome').setDescription('Nome').setRequired(true))
      .addStringOption(option => option.setName('cognome').setDescription('Cognome').setRequired(true))
      .addStringOption(option => option.setName('data_nascita').setDescription('Data di nascita (GG/MM/YYYY)').setRequired(true))
      .addStringOption(option => option.setName('motivo').setDescription('Motivo del ritiro').setRequired(true)),
    execute: async (interaction) => {
      const nome = interaction.options.getString('nome');
      const cognome = interaction.options.getString('cognome');
      const dataNascita = interaction.options.getString('data_nascita');
      const motivo = interaction.options.getString('motivo');
      
      const result = db.removePda(nome, cognome, dataNascita, motivo);
      
      if (!result.success) {
        return interaction.reply({ content: '❌ PDA non trovato!', ephemeral: true });
      }
      
      const embed = new EmbedBuilder()
        .setColor(0xff6600)
        .setTitle(`🔫 PDA RITIRATO`)
        .setFields([
          { name: 'Persona', value: `${nome} ${cognome}`, inline: true },
          { name: 'Motivo', value: motivo, inline: false },
          { name: 'Ritirato da', value: interaction.user.username, inline: true }
        ]);
      
      await interaction.reply({ embeds: [embed] });
    }
  },

  denuncia: {
    data: new SlashCommandBuilder()
      .setName('denuncia')
      .setDescription('Registra una denuncia')
      .addStringOption(option => option.setName('nome').setDescription('Nome denunciato').setRequired(true))
      .addStringOption(option => option.setName('cognome').setDescription('Cognome denunciato').setRequired(true))
      .addStringOption(option => option.setName('data').setDescription('Data denuncia (GG/MM/YYYY)').setRequired(true))
      .addStringOption(option => option.setName('reati').setDescription('Reati contestati').setRequired(true))
      .addStringOption(option => option.setName('chi_espone').setDescription('Chi espone la denuncia').setRequired(true))
      .addStringOption(option => option.setName('prove_reato').setDescription('Descrizione prove').setRequired(true))
      .addStringOption(option => option.setName('foto_url').setDescription('URL foto (opzionale)').setRequired(false))
      .addStringOption(option => option.setName('link_prove').setDescription('Link prove (opzionale)').setRequired(false)),
    execute: async (interaction) => {
      const nome = interaction.options.getString('nome');
      const cognome = interaction.options.getString('cognome');
      const data = interaction.options.getString('data');
      const reati = interaction.options.getString('reati');
      const chiEspone = interaction.options.getString('chi_espone');
      const proveReato = interaction.options.getString('prove_reato');
      const fotoUrl = interaction.options.getString('foto_url');
      const linkProve = interaction.options.getString('link_prove');
      
      const denunciaId = db.addDenuncia(nome, cognome, data, reati, chiEspone, proveReato, fotoUrl, linkProve);
      
      const embed = new EmbedBuilder()
        .setColor(0xff9900)
        .setTitle(`📋 DENUNCIA REGISTRATA`)
        .setFields([
          { name: 'ID Denuncia', value: `${denunciaId}`, inline: true },
          { name: 'Denunciato', value: `${nome} ${cognome}`, inline: true },
          { name: 'Data', value: data, inline: true },
          { name: 'Reati', value: reati, inline: false },
          { name: 'Esposta da', value: chiEspone, inline: true },
          { name: 'Prove', value: proveReato, inline: false },
          ...(fotoUrl ? [{ name: 'Foto', value: fotoUrl, inline: false }] : []),
          ...(linkProve ? [{ name: 'Link Prove', value: linkProve, inline: false }] : [])
        ]);
      
      await interaction.reply({ embeds: [embed] });
    }
  },

  edit_denuncia: {
    data: new SlashCommandBuilder()
      .setName('edit_denuncia')
      .setDescription('Modifica una denuncia')
      .addIntegerOption(option => option.setName('id').setDescription('ID della denuncia').setRequired(true))
      .addStringOption(option => option.setName('reati').setDescription('Reati').setRequired(false))
      .addStringOption(option => option.setName('prove_reato').setDescription('Prove').setRequired(false)),
    execute: async (interaction) => {
      const id = interaction.options.getInteger('id');
      const denuncia = db.getDenuncia(id);
      
      if (!denuncia) {
        return interaction.reply({ content: '❌ Denuncia non trovata!', ephemeral: true });
      }
      
      const updates = {};
      if (interaction.options.getString('reati')) updates.reati = interaction.options.getString('reati');
      if (interaction.options.getString('prove_reato')) updates.proveReato = interaction.options.getString('prove_reato');
      
      db.editDenuncia(id, updates);
      
      await interaction.reply({ content: `✅ Denuncia #${id} modificata con successo!`, ephemeral: true });
    }
  },

  multa: {
    data: new SlashCommandBuilder()
      .setName('multa')
      .setDescription('Registra una multa')
      .addStringOption(option => option.setName('nome').setDescription('Nome multato').setRequired(true))
      .addStringOption(option => option.setName('cognome').setDescription('Cognome multato').setRequired(true))
      .addStringOption(option => option.setName('data').setDescription('Data multa (GG/MM/YYYY)').setRequired(true))
      .addStringOption(option => option.setName('reato').setDescription('Motivo della multa').setRequired(true))
      .addUserOption(option => option.setName('agente').setDescription('Agente che ha fatto la multa').setRequired(false)),
    execute: async (interaction) => {
      const nome = interaction.options.getString('nome');
      const cognome = interaction.options.getString('cognome');
      const data = interaction.options.getString('data');
      const reato = interaction.options.getString('reato');
      const agente = interaction.options.getUser('agente') || interaction.user;
      
      const multaId = db.addMulta(agente.id, nome, cognome, data, reato);
      
      const embed = new EmbedBuilder()
        .setColor(0xffcc00)
        .setTitle(`💰 MULTA REGISTRATA`)
        .setFields([
          { name: 'ID Multa', value: `${multaId}`, inline: true },
          { name: 'Multato', value: `${nome} ${cognome}`, inline: true },
          { name: 'Data', value: data, inline: true },
          { name: 'Motivo', value: reato, inline: false },
          { name: 'Agente', value: agente.username, inline: true }
        ]);
      
      await interaction.reply({ embeds: [embed] });
    }
  },

  edit_multa: {
    data: new SlashCommandBuilder()
      .setName('edit_multa')
      .setDescription('Modifica una multa')
      .addIntegerOption(option => option.setName('id').setDescription('ID della multa').setRequired(true))
      .addStringOption(option => option.setName('reato').setDescription('Motivo multa').setRequired(false)),
    execute: async (interaction) => {
      const id = interaction.options.getInteger('id');
      const multa = db.getMulta(id);
      
      if (!multa) {
        return interaction.reply({ content: '❌ Multa non trovata!', ephemeral: true });
      }
      
      const updates = {};
      if (interaction.options.getString('reato')) updates.reato = interaction.options.getString('reato');
      
      db.editMulta(id, updates);
      
      await interaction.reply({ content: `✅ Multa #${id} modificata con successo!`, ephemeral: true });
    }
  },

  sequestra_macchina: {
    data: new SlashCommandBuilder()
      .setName('sequestra_macchina')
      .setDescription('Sequestra una macchina')
      .addStringOption(option => option.setName('nome').setDescription('Nome proprietario').setRequired(true))
      .addStringOption(option => option.setName('cognome').setDescription('Cognome proprietario').setRequired(true))
      .addStringOption(option => option.setName('data').setDescription('Data sequestro (GG/MM/YYYY)').setRequired(true))
      .addStringOption(option => option.setName('targa').setDescription('Targa veicolo').setRequired(true))
      .addStringOption(option => option.setName('motivo').setDescription('Motivo sequestro').setRequired(true))
      .addNumberOption(option => option.setName('multa').setDescription('Importo multa').setRequired(true))
      .addUserOption(option => option.setName('agenti').setDescription('Agenti coinvolti').setRequired(false)),
    execute: async (interaction) => {
      const nome = interaction.options.getString('nome');
      const cognome = interaction.options.getString('cognome');
      const data = interaction.options.getString('data');
      const targa = interaction.options.getString('targa');
      const motivo = interaction.options.getString('motivo');
      const multa = interaction.options.getNumber('multa');
      const agentiMenzionati = interaction.mentions.users.map(u => u.id) || [interaction.user.id];
      
      const sequestroId = db.addSequestro(agentiMenzionati, nome, cognome, data, targa, motivo, multa);
      
      const embed = new EmbedBuilder()
        .setColor(0x0066ff)
        .setTitle(`🚗 MACCHINA SEQUESTRATA`)
        .setFields([
          { name: 'ID Sequestro', value: `${sequestroId}`, inline: true },
          { name: 'Proprietario', value: `${nome} ${cognome}`, inline: true },
          { name: 'Targa', value: targa, inline: true },
          { name: 'Data', value: data, inline: true },
          { name: 'Motivo', value: motivo, inline: false },
          { name: 'Multa', value: `€${multa}`, inline: true }
        ]);
      
      await interaction.reply({ embeds: [embed] });
    }
  },

  dissezestra: {
    data: new SlashCommandBuilder()
      .setName('dissezestra')
      .setDescription('Rilascia una macchina sequestrata')
      .addStringOption(option => option.setName('nome').setDescription('Nome proprietario').setRequired(true))
      .addStringOption(option => option.setName('cognome').setDescription('Cognome proprietario').setRequired(true))
      .addStringOption(option => option.setName('data').setDescription('Data sequestro (GG/MM/YYYY)').setRequired(true))
      .addStringOption(option => option.setName('targa').setDescription('Targa veicolo').setRequired(true)),
    execute: async (interaction) => {
      const nome = interaction.options.getString('nome');
      const cognome = interaction.options.getString('cognome');
      const data = interaction.options.getString('data');
      const targa = interaction.options.getString('targa');
      
      const result = db.removeSequestro(nome, cognome, data, targa);
      
      if (!result) {
        return interaction.reply({ content: '❌ Sequestro non trovato!', ephemeral: true });
      }
      
      const embed = new EmbedBuilder()
        .setColor(0x66ff00)
        .setTitle(`🚗 MACCHINA RILASCIATA`)
        .setFields([
          { name: 'Proprietario', value: `${nome} ${cognome}`, inline: true },
          { name: 'Targa', value: targa, inline: true },
          { name: 'Liberata da', value: interaction.user.username, inline: true }
        ]);
      
      await interaction.reply({ embeds: [embed] });
    }
  },

  edit_sequestro: {
    data: new SlashCommandBuilder()
      .setName('edit_sequestro')
      .setDescription('Modifica un sequestro')
      .addIntegerOption(option => option.setName('id').setDescription('ID sequestro').setRequired(true))
      .addStringOption(option => option.setName('motivo').setDescription('Motivo').setRequired(false))
      .addNumberOption(option => option.setName('multa').setDescription('Multa').setRequired(false)),
    execute: async (interaction) => {
      const id = interaction.options.getInteger('id');
      const sequestro = db.getSequestro(id);
      
      if (!sequestro) {
        return interaction.reply({ content: '❌ Sequestro non trovato!', ephemeral: true });
      }
      
      const updates = {};
      if (interaction.options.getString('motivo')) updates.motivo = interaction.options.getString('motivo');
      if (interaction.options.getNumber('multa') !== null) updates.multa = interaction.options.getNumber('multa');
      
      db.editSequestro(id, updates);
      
      await interaction.reply({ content: `✅ Sequestro #${id} modificato con successo!`, ephemeral: true });
    }
  },

  info: {
    data: new SlashCommandBuilder()
      .setName('info')
      .setDescription('Visualizza informazioni di una persona')
      .addStringOption(option => option.setName('nome').setDescription('Nome').setRequired(true))
      .addStringOption(option => option.setName('cognome').setDescription('Cognome').setRequired(true))
      .addStringOption(option => option.setName('data_nascita').setDescription('Data di nascita (GG/MM/YYYY)').setRequired(true)),
    execute: async (interaction) => {
      const nome = interaction.options.getString('nome');
      const cognome = interaction.options.getString('cognome');
      const dataNascita = interaction.options.getString('data_nascita');
      
      let persona = db.getPersona(nome, cognome, dataNascita);
      
      if (!persona) {
        persona = {
          nome,
          cognome,
          dataNascita,
          fedina: 'pulita',
          arresti: [],
          denuncie: [],
          multe: [],
          macchineSequestrate: [],
          pda: null
        };
      }
      
      const embed = createInfoPersonaEmbed(persona);
      await interaction.reply({ embeds: [embed] });
    }
  },

  pulisci_fedina: {
    data: new SlashCommandBuilder()
      .setName('pulisci_fedina')
      .setDescription('[RUOLO SPECIALE] Pulisce la fedina di una persona')
      .addStringOption(option => option.setName('nome').setDescription('Nome').setRequired(true))
      .addStringOption(option => option.setName('cognome').setDescription('Cognome').setRequired(true))
      .addStringOption(option => option.setName('data_nascita').setDescription('Data di nascita (GG/MM/YYYY)').setRequired(true))
      .addStringOption(option => option.setName('motivo').setDescription('Motivo della pulizia').setRequired(true))
      .addStringOption(option => option.setName('foto_pagamento').setDescription('URL foto comprovante pagamento').setRequired(true)),
    execute: async (interaction) => {
      if (!hasRole(interaction.member, PULISCI_FEDINA_ROLE)) {
        return interaction.reply({ content: '❌ Non hai il permesso per usare questo comando!', ephemeral: true });
      }
      
      const nome = interaction.options.getString('nome');
      const cognome = interaction.options.getString('cognome');
      const dataNascita = interaction.options.getString('data_nascita');
      const motivo = interaction.options.getString('motivo');
      const fotoPagamento = interaction.options.getString('foto_pagamento');
      
      const result = db.pulisciFedina(nome, cognome, dataNascita);
      
      if (!result) {
        return interaction.reply({ content: '❌ Persona non trovata!', ephemeral: true });
      }
      
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(`✅ FEDINA PULITA`)
        .setThumbnail(fotoPagamento)
        .setFields([
          { name: 'Persona', value: `${nome} ${cognome}`, inline: true },
          { name: 'Data Nascita', value: dataNascita, inline: true },
          { name: 'Motivo', value: motivo, inline: false },
          { name: 'Pulita da', value: interaction.user.username, inline: true },
          { name: 'Data', value: new Date().toLocaleString('it-IT'), inline: true }
        ]);
      
      await interaction.reply({ embeds: [embed] });
    }
  }
};

module.exports = commands;
