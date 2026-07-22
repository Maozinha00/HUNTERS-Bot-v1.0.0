/**
 * 🐺 CLÃ HUNTERS - DISCORD BOT ERP STANDALONE v5.0 (OFICIAL)
 * 
 * Requisitos:
 * npm install discord.js dotenv
 */

import { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  InteractionType, 
  ActivityType,
  PermissionFlagsBits
} from 'discord.js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// CONFIGURAÇÃO DOS CANAIS E CARGOS DO SERVIDOR
const CONFIG = {
  PREFIX: '!',
  CANAL_REGRAS_ID: '1522910276268069025',
  CANAL_LOG_METAS_ID: '1525698045537161226',
  CANAL_PAINEL_ID: '1523844178151473193',
  CARGO_RECRUTA_ID: '1515125826780135485',
  CARGO_GERENTE_ID: '1523277774436171796',
  META_ACO_KG: 8000,
  CUSTO_ACO_POR_KG: 4.50,
  SPLIT_CLAN_PERCENT: 30
};

// ESTADO GLOBAL DO BANCO E PERSISTÊNCIA LOCAL
const DB_FILE = './hunters-db.json';
let db = {
  bancoDinheiro: 868392.00,
  estoque: { acoBau: 69000, acoMaoTotal: 12500, kitsMontados: 8 },
  vendas: [],
  farmes: [],
  retiradas: [],
  recrutamentos: [],
  painelCanalId: null,
  painelMensagemId: null
};

function carregarBanco() {
  if (fs.existsSync(DB_FILE)) {
    try {
      db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) };
      console.log('📂 Banco de dados local carregado com sucesso!');
    } catch (e) {
      console.error('Erro ao ler hunters-db.json:', e);
    }
  } else {
    salvarBanco();
  }
}

function salvarBanco() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

const formatarMoeda = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
const formatarNumero = (val) => new Intl.NumberFormat('pt-BR').format(val || 0);

// CLIENTE DISCORD
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// LOGS DISCORD EMBED
async function registrarLogDiscord(guild, titulo, descricao, campos = [], cor = 0xa855f7) {
  try {
    const canalLog = guild.channels.cache.get(CONFIG.CANAL_LOG_METAS_ID) || 
                     await guild.channels.fetch(CONFIG.CANAL_LOG_METAS_ID).catch(() => null);
    if (canalLog) {
      const embed = new EmbedBuilder()
        .setTitle(titulo)
        .setColor(cor)
        .setDescription(descricao)
        .addFields(campos)
        .setFooter({ text: 'Hunters ERP • Logs Oficiais' })
        .setTimestamp();

      await canalLog.send({ content: '🚨 **REGISTRO HUNTERS ERP - LOGS**', embeds: [embed] });
    }
  } catch (e) {
    console.error('Erro ao enviar log no Discord:', e);
  }
}

// ATUALIZAR PAINEL DISCORD
async function atualizarPainel(guild) {
  try {
    const canalId = db.painelCanalId || CONFIG.CANAL_PAINEL_ID;
    const canal = guild.channels.cache.get(canalId) || await guild.channels.fetch(canalId).catch(() => null);
    if (!canal) return;

    const totalFarmado = db.farmes.reduce((acc, f) => acc + (f.quantidade || 0), 0);
    const totalVendidoBruto = db.vendas.reduce((acc, v) => acc + (v.valorTotalBruto || 0), 0);
    const totalLucroLiquido = db.vendas.reduce((acc, v) => acc + (v.lucroLiquidoClan || 0), 0);

    const embed = new EmbedBuilder()
      .setTitle('🐺 HUNTERS LOGÍSTICA & CONTROLE TÁTICO DE ESTOQUE')
      .setColor('#a855f7')
      .setDescription(`\`\`\`
╔═══════════════════════════════════════════════════════════════╗
║   🐺 HUNTERS ERP - PAINEL TÁTICO CENTRAL DE ESTOQUE & DADOS   ║
╚═══════════════════════════════════════════════════════════════╝

 💵 BANCO DE DINHEIRO: ......... ${formatarMoeda(db.bancoDinheiro)}
 📦 AÇO NO BAÚ (COFRE): ........ ${formatarNumero(db.estoque.acoBau)} kg
 ✋ AÇO NA MÃO (MEMBROS): ....... ${formatarNumero(db.estoque.acoMaoTotal)} kg
 🔥 KITS MONTADOS PRONTOS: ...... ${db.estoque.kitsMontados} Kits Completos

 📈 FATURAMENTO BRUTO: .......... ${formatarMoeda(totalVendidoBruto)}
 🟢 LUCRO LÍQUIDO DO CLÃ: ....... ${formatarMoeda(totalLucroLiquido)}
 🌾 TOTAL DE AÇO FARMADO: ....... ${formatarNumero(totalFarmado)} kg
 🎯 META SEMANAL POR MEMBRO: .... ${formatarNumero(CONFIG.META_ACO_KG)} kg
\`\`\``)
      .setFooter({ text: 'Hunters ERP • Sorte aos Fortes 🐺' })
      .setTimestamp();

    const rowAcoes = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_farme').setLabel('Entregar Farme').setStyle(ButtonStyle.Success).setEmoji('📦'),
      new ButtonBuilder().setCustomId('btn_venda').setLabel('Registrar Venda').setStyle(ButtonStyle.Primary).setEmoji('💰'),
      new ButtonBuilder().setCustomId('btn_retirar').setLabel('Retirar Aço').setStyle(ButtonStyle.Danger).setEmoji('📤'),
      new ButtonBuilder().setCustomId('btn_perfil').setLabel('Meu Perfil').setStyle(ButtonStyle.Secondary).setEmoji('👤')
    );

    const rowConsultas = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_arsenal').setLabel('Tabela de Preços').setStyle(ButtonStyle.Secondary).setEmoji('🛒'),
      new ButtonBuilder().setCustomId('btn_ranking').setLabel('Ranking').setStyle(ButtonStyle.Secondary).setEmoji('🏆'),
      new ButtonBuilder().setCustomId('btn_admin').setLabel('Painel Gerente').setStyle(ButtonStyle.Danger).setEmoji('⚙️')
    );

    const payload = { embeds: [embed], components: [rowAcoes, rowConsultas] };

    if (db.painelMensagemId) {
      try {
        const msg = await canal.messages.fetch(db.painelMensagemId);
        if (msg) return await msg.edit(payload);
      } catch (e) {}
    }

    const novaMsg = await canal.send(payload);
    db.painelCanalId = canalId;
    db.painelMensagemId = novaMsg.id;
    salvarBanco();
  } catch (err) {
    console.error('Erro ao atualizar painel:', err);
  }
}

// NOVO MEMBRO ENTRA (RECRUTAMENTO)
client.on('guildMemberAdd', async (member) => {
  try {
    const roleRecruta = member.guild.roles.cache.get(CONFIG.CARGO_RECRUTA_ID);
    if (roleRecruta) await member.roles.add(roleRecruta).catch(() => null);

    const canalRegras = member.guild.channels.cache.get(CONFIG.CANAL_REGRAS_ID) ||
                        await member.guild.channels.fetch(CONFIG.CANAL_REGRAS_ID).catch(() => null);

    if (canalRegras) {
      const embedWelcome = new EmbedBuilder()
        .setTitle('🐺 SEJA BEM-VINDO(A) AO CLÃ HUNTERS!')
        .setColor('#a855f7')
        .setDescription(`Olá <@${member.id}>! Você acaba de entrar no servidor do **ClÃ Hunters**! ☣️\n\n📌 Leia as regras do servidor e clique no botão abaixo para confirmar leitura.`)
        .setFooter({ text: 'Hunters Recruitment' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_regras_aceitar').setLabel('Li e Aceito as Regras').setStyle(ButtonStyle.Success).setEmoji('✅')
      );

      await canalRegras.send({ content: `🚨 **NOVO RECRUTA!** <@${member.id}> <@&${CONFIG.CARGO_GERENTE_ID}>`, embeds: [embedWelcome], components: [row] });
    }
  } catch (e) {
    console.error('Erro no guildMemberAdd:', e);
  }
});

// INTERAÇÕES E VERIFICAÇÃO DE GERENTE
client.on('interactionCreate', async (interaction) => {
  const { user, guild, member } = interaction;
  if (!guild) return;

  // VERIFICADOR DE PERMISSÃO DE GERENTE
  const isManager = () => {
    return member?.roles?.cache?.has(CONFIG.CARGO_GERENTE_ID) || 
           member?.permissions?.has(PermissionFlagsBits.Administrator) ||
           member?.permissions?.has(PermissionFlagsBits.ManageGuild);
  };

  if (interaction.isButton()) {

    // CONFIRMAR REGRAS
    if (interaction.customId === 'btn_regras_aceitar') {
      await interaction.deferReply({ ephemeral: true });
      await interaction.editReply({ content: '✅ **Regras Oficiais Confirmadas com Sucesso!**' });
      await registrarLogDiscord(guild, '✅ REGISTRO DE REGRAS', `Membro <@${user.id}> confirmou as regras.`, [], 0x10b981);
    }

    // BOTÃO PAINEL GERENTE (PROTEGIDO)
    if (interaction.customId === 'btn_admin') {
      if (!isManager()) {
        return interaction.reply({
          content: `❌ **Acesso Negado ao Painel Gerencial!**\nVocê precisa do cargo <@&${CONFIG.CARGO_GERENTE_ID}> ou permissão de Administrador do servidor.`,
          ephemeral: true
        });
      }

      const modal = new ModalBuilder().setCustomId('modal_admin').setTitle('⚙️ Painel Gerencial • Ajustes');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('admin_banco').setLabel('Banco (R$)').setValue(String(db.bancoDinheiro)).setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('admin_acobau').setLabel('Aço Baú (kg)').setValue(String(db.estoque.acoBau)).setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('admin_acomao').setLabel('Aço Mão (kg)').setValue(String(db.estoque.acoMaoTotal)).setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('admin_kits').setLabel('Kits Montados').setValue(String(db.estoque.kitsMontados)).setStyle(TextInputStyle.Short).setRequired(true))
      );
      await interaction.showModal(modal);
    }
  }

  if (interaction.type === InteractionType.ModalSubmit) {
    if (interaction.customId === 'modal_admin') {
      if (!isManager()) {
        return interaction.reply({ content: '❌ **Acesso Negado ao Painel Gerencial!**', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });
      db.bancoDinheiro = parseFloat(interaction.fields.getTextInputValue('admin_banco')) || db.bancoDinheiro;
      db.estoque.acoBau = parseInt(interaction.fields.getTextInputValue('admin_acobau')) || db.estoque.acoBau;
      db.estoque.acoMaoTotal = parseInt(interaction.fields.getTextInputValue('admin_acomao')) || db.estoque.acoMaoTotal;
      db.estoque.kitsMontados = parseInt(interaction.fields.getTextInputValue('admin_kits')) || db.estoque.kitsMontados;
      salvarBanco();

      await interaction.editReply({ content: '⚙️ **Alterações Gerenciais Salvas com Sucesso!**' });
      await atualizarPainel(guild);
    }
  }
});

// INICIALIZAÇÃO
client.once('ready', () => {
  console.log(`🤖 Bot Clã Hunters Online como ${client.user.tag}!`);
  client.user.setActivity('Hunters ERP • Logística Tática', { type: ActivityType.Playing });
  carregarBanco();
  client.guilds.cache.forEach((guild) => atualizarPainel(guild));
});

client.login(process.env.DISCORD_TOKEN);
