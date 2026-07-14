/**
 * 🐺 HUNTERS ERP - DISCORD BOT CENTRALIZADO (v4.1 - CORRIGIDO E SEGURO)
 * 
 * Script completo pronto para rodar.
 * Desenvolvido para o Clã Hunters. Mantém o controle de estoque, 
 * finanças, comissões de vendas, metas semanais e avisos.
 * 
 * Requisitos:
 *   - Node.js v16.11.0 ou superior
 *   - Dependências: npm install discord.js dotenv
 * 
 * Configuração:
 *   1. Crie um arquivo chamado `.env` na mesma pasta do script com o conteúdo:
 *      DISCORD_TOKEN=INSIRA_SEU_TOKEN_AQUI
 *   2. Configure os IDs dos canais e cargos abaixo para corresponderem ao seu servidor.
 *   3. IMPORTANTE: Ative a opção "MESSAGE CONTENT INTENT" no Discord Developer Portal (Aba Bot).
 *   4. Inicie o bot executando: node bot.js
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
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

// CONFIGURAÇÕES GERAIS DO CLÃ (Configure com seus IDs padrão)
const CONFIG = {
  PREFIX: '!',
  CANAL_AVISOS_ID: '1515125864033943712',
  CARGO_NOTIFICAR_ID: '1515125826780135485',
  CANAL_PAINEL_ID: '1523844178151473193',
  META_ACO_KG: 8000,
  CUSTO_KIT_KG: 3260,
  SPLIT_CLAN_PERCENT: 30, // 30% Comissão Membro, 70% Clã
  PERCENT_STEEL_FOR_KITS: 30, // 30% para kits
  PERCENT_STEEL_FOR_SALES: 70 // 70% para vendas
};

// TABELA DE ARMAS E REQUISITOS DE AÇO / PREÇOS
const ARMAS = {
  ak47: { nome: "AK-47", preco: 35000, aco: 2700 },
  awp: { nome: "AWP", preco: 65000, aco: 3000 },
  m16: { nome: "M16", preco: 35000, aco: 2700 },
  sawnoff: { nome: "Sawed-Off Shotgun", preco: 20000, aco: 1200 },
  glock17: { nome: "Glock 17", preco: 5000, aco: 120 },
  tec9: { nome: "TEC-9", preco: 15000, aco: 900 },
  taser: { nome: "Taser", preco: 10000, aco: 700 },
  silenciador: { nome: "Silenciador", preco: 2000, aco: 20 },
  carregador_est: { nome: "Carregador Estendido", preco: 3000, aco: 25 },
  grip: { nome: "Grip", preco: 3000, aco: 30 },
  lanterna: { nome: "Lanterna", preco: 2000, aco: 30 },
  box_m_pistola: { nome: "Box Pistola", preco: 2000, aco: 40 },
  box_m_sub: { nome: "Box Submetralhadora", preco: 3000, aco: 80 },
  box_m_escopeta: { nome: "Box Escopeta", preco: 4000, aco: 100 },
  box_m_556: { nome: "Box 5.56", preco: 5000, aco: 120 },
  box_m_308: { nome: "Box .308", preco: 5000, aco: 200 }
};

// INICIALIZAÇÃO DO BANCO DE DADOS LOCAL ( hunters-db.json )
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'hunters-db.json');
let db = {
  estoque: 69000, // kg inicial
  estoqueKits: 20700,
  estoqueVendas: 48300,
  caixa: 280000, // R$ inicial
  vendas: [],
  farmes: [],
  config: { ...CONFIG },
  painelCanalId: null,
  painelMensagemId: null
};

// Carregar dados salvos se existirem
function carregarBanco() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(data);
      console.log('💾 [HUNTERS] Banco de dados carregado com sucesso!');
    } else {
      salvarBanco();
      console.log('💾 [HUNTERS] Novo arquivo de banco de dados criado!');
    }
  } catch (err) {
    console.error('❌ [HUNTERS] Erro ao carregar banco de dados:', err.message);
  }
}

// Salvar dados no arquivo JSON
function salvarBanco() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('❌ [HUNTERS] Erro ao salvar banco de dados:', err.message);
  }
}

// INICIALIZANDO CLIENT DO DISCORD COM INTENTS REQUISITADOS
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // <-- NECESSÁRIO para comandos prefixados
    GatewayIntentBits.GuildMembers
  ]
});

// FUNÇÃO PARA ATUALIZAR PARCELAS DE ESTOQUE
function recalcularEstoqueDividido() {
  const pctKits = 30; // 30% reserva para kits, 70% para vendas
  db.estoqueKits = Math.floor((db.estoque * pctKits) / 100);
  db.estoqueVendas = db.estoque - db.estoqueKits;
}

// FORMATADORES DE TEXTO
const formatarMoeda = (val) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
};
const formatarNumero = (val) => {
  return new Intl.NumberFormat('pt-BR').format(val);
};

// OBTER ACUMULADO DE AÇO
function obterAcoTotalMembro(userId) {
  let total = 0;
  if (db.farmes) {
    db.farmes.forEach(f => {
      if (f.userId === userId) total += f.quantidade;
    });
  }
  if (db.vendas) {
    db.vendas.forEach(v => {
      if (v.userId === userId) total += (v.acoConsumido || 0);
    });
  }
  return total;
}

// CHECAR SE MEMBRO BATEU A META E MANDAR AVISO
async function verificarMetaAtingida(userId, userName, totalAcoAnterior, totalAcoNovo, guild) {
  const meta = db.config.META_ACO_KG || 8000;
  if (totalAcoAnterior < meta && totalAcoNovo >= meta) {
    const canalAvisos = guild.channels.cache.get(db.config.CANAL_AVISOS_ID) 
      || await guild.channels.fetch(db.config.CANAL_AVISOS_ID).catch(() => null);

    if (canalAvisos) {
      const embedMeta = new EmbedBuilder()
        .setTitle('🎉 META DE AÇO ATINGIDA! 🎉')
        .setColor('#a855f7')
        .setDescription(`🏆 **Excelente trabalho na facção!**\n\n👤 **Membro:** <@${userId}> (${userName})\n⛓️ **Aço Acumulado:** **${formatarNumero(totalAcoNovo)} kg** / ${formatarNumero(meta)} kg\n\nO membro bateu a meta semanal de aço e garantiu seu **Kit de Meta**! Foco total! 🐺`)
        .setFooter({ text: 'Hunters ERP • Sorte aos Fortes' })
        .setTimestamp();

      await canalAvisos.send({
        content: `🚨 **META BATIDA!** <@${userId}> superou o objetivo semanal de aço! Parabéns! ⚔️`,
        embeds: [embedMeta]
      }).catch(() => null);
    }
  }
}

// GERAR O PAYLOAD VISUAL DO PAINEL CENTRAL
function obterPainelPayload() {
  const kitsDisponiveis = Math.floor(db.estoqueKits / db.config.CUSTO_KIT_KG);
  const totalDepositado = db.farmes.reduce((acc, f) => acc + f.quantidade, 0);
  const metaObjetivo = db.config.META_ACO_KG || 8000;
  const progressoPct = Math.min(100, Math.floor((totalDepositado / metaObjetivo) * 100));

  const totalCharsBar = 30;
  const filledChars = Math.min(totalCharsBar, Math.floor((progressoPct / 100) * totalCharsBar));
  const emptyChars = totalCharsBar - filledChars;
  const progressBar = '█'.repeat(filledChars) + '░'.repeat(emptyChars);

  const totalVendido = db.vendas.reduce((acc, v) => acc + (v.total || 0), 0);
  const splitClan = db.config.SPLIT_CLAN_PERCENT !== undefined ? db.config.SPLIT_CLAN_PERCENT : 30;
  const splitClanPercent = 100 - splitClan;
  const receitaClan = totalVendido * (splitClanPercent / 100);
  const comissaoTotal = totalVendido * (splitClan / 100);
  const patrimonioTotal = db.caixa;
  const vendasCount = db.vendas.length;

  const todosUsuarios = new Set([...db.farmes.map(f => f.userId), ...db.vendas.map(v => v.userId)]);
  let metasBatidasCount = 0;
  todosUsuarios.forEach(userId => {
    if (obterAcoTotalMembro(userId) >= metaObjetivo) {
      metasBatidasCount++;
    }
  });

  const totalFarmadoGeral = db.farmes.reduce((acc, f) => acc + f.quantidade, 0);
  const totalVendidoGeral = db.vendas.reduce((acc, v) => acc + (v.acoConsumido || 0), 0);
  const colaboradoresAtivosCount = todosUsuarios.size;

  const internalWidth = 61;
  const formatBoxLine = (content) => '┃ ' + content.padEnd(internalWidth, ' ') + ' ┃';
  const formatDots = (left, right, width = 61) => {
    const dotsCount = width - left.length - right.length;
    return left + '.'.repeat(Math.max(1, dotsCount)) + right;
  };

  const lines = [
    '╔═══════════════════════════════════════════════════════════════╗',
    '║                                                               ║',
    '║   ██╗  ██╗ ██╗   ██╗ ███╗   ██╗ ████████╗ ███████╗ ██████╗    ║',
    '║   ██║  ██║ ██║   ██║ ████╗  ██║ ╚══██╔══╝ ██╔════╝ ██╔══██╗   ║',
    '║   ███████║ ██║   ██║ ██╔██╗ ██║    ██║    █████╗   ██████╔╝   ║',
    '║   ██╔══██║ ██║   ██║ ██║╚██╗██║    ██║    ██╔══╝   ██╔══██╗   ║',
    '║   ██║  ██║ ╚██████╔╝ ██║ ╚████║    ██║    ███████╗ ██║  ██║   ║',
    '║   ╚═╝  ╚═╝  ╚═════╝  ╚═╝  ╚═══╝    ╚═╝    ╚══════╝ ╚═╝  ╚═╝   ║',
    '║                                                               ║',
    '╚═══════════════════════════════════════════════════════════════╝',
    '',
    '┏━━━━━━━━━━━━━━━━━━━━━━━━━━ 📦 ESTOQUE ━━━━━━━━━━━━━━━━━━━━━━━━━━┓',
    formatBoxLine(formatDots('Aço Tático em Estoque', formatarNumero(db.estoque) + ' kg')),
    formatBoxLine(formatDots('Kits de Meta Disponíveis', kitsDisponiveis + ' Unidades')),
    formatBoxLine(formatDots('Reserva de Kits', formatarNumero(db.estoqueKits) + ' kg')),
    '┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛',
    '',
    '┏━━━━━━━━━━━━━━━━━━━━━━━━ 💰 FINANCEIRO ━━━━━━━━━━━━━━━━━━━━━━━━┓',
    formatBoxLine(formatDots('Cofre da Facção', formatarMoeda(patrimonioTotal))),
    formatBoxLine(formatDots('Total de Vendas no Ciclo', formatarMoeda(totalVendido))),
    formatBoxLine(formatDots('Split do Clã (' + splitClanPercent + '%)', formatarMoeda(receitaClan))),
    formatBoxLine(formatDots('Comissões Membros (' + splitClan + '%)', formatarMoeda(comissaoTotal))),
    '┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛',
    '',
    '┏━━━━━━━━━━━━━━━━━━━━━━ 🎯 META DA SEMANA ━━━━━━━━━━━━━━━━━━━━━━┓',
    formatBoxLine(formatDots('Objetivo de Aço Semanal', formatarNumero(metaObjetivo) + ' kg')),
    formatBoxLine(formatDots('Aço Depositado no Ciclo', formatarNumero(totalDepositado) + ' kg')),
    formatBoxLine(formatDots('Membros que Bateram a Meta', metasBatidasCount + ' Colaboradores')),
    formatBoxLine(''),
    formatBoxLine('Progresso: [' + progressBar + '] ' + progressoPct + '%'),
    '┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛',
    '',
    '┏━━━━━━━━━━━━━━━━━━━━━ 📊 ESTATÍSTICAS GERAIS ━━━━━━━━━━━━━━━━━━━━┓',
    formatBoxLine(formatDots('Total Farmado (Histórico)', formatarNumero(totalFarmadoGeral) + ' kg')),
    formatBoxLine(formatDots('Aço Vendido (Histórico)', formatarNumero(totalVendidoGeral) + ' kg')),
    formatBoxLine(formatDots('Vendas Registradas', vendasCount + ' transações')),
    formatBoxLine(formatDots('Colaboradores Ativos', colaboradoresAtivosCount + ' membros')),
    '┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛'
  ];

  const embed = new EmbedBuilder()
    .setTitle('🐺 HUNTERS LOGÍSTICA & CONTROLE CENTRAL')
    .setColor('#a855f7')
    .setDescription('```\n' + lines.join('\n') + '\n```')
    .setFooter({ text: 'Hunters ERP • Painel Operacional Central' })
    .setTimestamp();

  const rowAcoes = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_farme').setLabel('Entregar Farme').setStyle(ButtonStyle.Success).setEmoji('📦'),
    new ButtonBuilder().setCustomId('btn_venda').setLabel('Registrar Venda').setStyle(ButtonStyle.Primary).setEmoji('💰'),
    new ButtonBuilder().setCustomId('btn_perfil').setLabel('Meu Perfil').setStyle(ButtonStyle.Secondary).setEmoji('👤')
  );

  const rowConsultas = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_arsenal').setLabel('Tabela de Preços').setStyle(ButtonStyle.Secondary).setEmoji('🔫'),
    new ButtonBuilder().setCustomId('btn_ranking').setLabel('Ranking de Farme').setStyle(ButtonStyle.Secondary).setEmoji('🏆'),
    new ButtonBuilder().setCustomId('btn_admin').setLabel('Painel Admin').setStyle(ButtonStyle.Danger).setEmoji('⚙️')
  );

  return {
    embeds: [embed],
    components: [rowAcoes, rowConsultas]
  };
}

// ATUALIZAÇÃO DO PAINEL CENTRALIZADO NO DISCORD
async function atualizarPainel(guild) {
  try {
    const canalId = db.painelCanalId || db.config.CANAL_PAINEL_ID;
    if (!canalId) return;

    const canal = guild.channels.cache.get(canalId) 
      || await guild.channels.fetch(canalId).catch(() => null);

    if (!canal) {
      console.log(`⚠️ [HUNTERS] Canal de Painel (${canalId}) não encontrado.`);
      return;
    }

    const payload = obterPainelPayload();

    if (db.painelMensagemId) {
      try {
        const msg = await canal.messages.fetch(db.painelMensagemId);
        if (msg) {
          await msg.edit(payload);
          return;
        }
      } catch (e) {
        // Ignora e cria nova
      }
    }

    const novaMsg = await canal.send(payload);
    db.painelCanalId = canalId;
    db.painelMensagemId = novaMsg.id;
    salvarBanco();
    console.log('✅ [HUNTERS] Painel operacional enviado e registrado!');

  } catch (err) {
    console.error('❌ [HUNTERS] Erro ao atualizar painel central:', err.message);
  }
}

// EVENTO: BOT PRONTO
client.once('ready', async () => {
  console.log(`🤖 [HUNTERS] Bot online como ${client.user.tag}!`);
  carregarBanco();
  recalcularEstoqueDividido();

  client.user.setActivity('Hunters ERP • Operacional', { type: ActivityType.Playing });

  client.guilds.cache.forEach(async (guild) => {
    await atualizarPainel(guild);
  });
});

// ==========================================
// 1. EVENTO: RECEBIMENTO DE COMANDOS (NOVO!)
// ==========================================
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const prefix = db.config.PREFIX || '!';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // COMANDO: !AVISOS <MENSAGEM>
  if (command === 'avisos') {
    // PROTEÇÃO: Apenas administradores do Discord podem executar
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('❌ **Apenas administradores** do servidor podem utilizar o comando de avisos.')
        .then(msg => setTimeout(() => msg.delete().catch(() => null), 6000));
    }

    const textoAviso = args.join(' ');
    if (!textoAviso) {
      return message.reply(`❌ **Uso correto:** \`${prefix}avisos <conteúdo do aviso>\``);
    }

    const canalAvisosId = db.config.CANAL_AVISOS_ID;
    const canalAvisos = message.guild.channels.cache.get(canalAvisosId)
      || await message.guild.channels.fetch(canalAvisosId).catch(() => null);

    if (!canalAvisos) {
      return message.reply(`❌ **Canal de avisos não encontrado!** Verifique se o ID \`${canalAvisosId}\` está correto.`);
    }

    const embedAviso = new EmbedBuilder()
      .setTitle('📢 COMUNICADO IMPORTANTE • CLÃ HUNTERS')
      .setColor('#a855f7')
      .setDescription(textoAviso)
      .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
      .setFooter({ text: 'Hunters ERP • Sorte aos Fortes 🐺' })
      .setTimestamp();

    const mensionRole = db.config.CARGO_NOTIFICAR_ID ? `<@&${db.config.CARGO_NOTIFICAR_ID}>` : '';

    await canalAvisos.send({
      content: mensionRole ? `🚨 ${mensionRole} novo comunicado importante!` : '🚨 **Atenção Clã Hunters!**',
      embeds: [embedAviso]
    });

    await message.reply(`✅ **Aviso enviado com sucesso** no canal de texto <#${canalAvisosId}>!`);
  }

  // COMANDO: !PAINEL (Para gerar ou resetar o painel central)
  if (command === 'painel') {
    // PROTEÇÃO: Apenas administradores podem acionar a geração do painel
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('❌ **Erro de Permissão:** Apenas administradores podem gerar o painel central.')
        .then(msg => setTimeout(() => msg.delete().catch(() => null), 6000));
    }

    await message.delete().catch(() => null);

    db.painelCanalId = message.channel.id;
    db.painelMensagemId = null; // Forçar criação de nova mensagem
    salvarBanco();

    await atualizarPainel(message.guild);
    
    // Envia um aviso rápido de confirmação
    const tempMsg = await message.channel.send('✅ **Painel operacional centralizado gerado com sucesso neste canal!**');
    setTimeout(() => tempMsg.delete().catch(() => null), 5000);
  }
});

// ==========================================
// 2. EVENTO: INTERAÇÃO DE BOTÕES / MODAIS
// ==========================================
client.on('interactionCreate', async (interaction) => {
  const { user, guild } = interaction;
  if (!guild) return;

  // CLIQUE NOS BOTÕES
  if (interaction.isButton()) {
    
    // BOTÃO: ENTREGAR FARME
    if (interaction.customId === 'btn_farme') {
      const modal = new ModalBuilder()
        .setCustomId('modal_farme')
        .setTitle('📦 Entregar Farme de Aço');

      const inputAco = new TextInputBuilder()
        .setCustomId('qtd_aco')
        .setLabel('Quantidade de Aço (em kg)')
        .setPlaceholder('Ex: 500')
        .setMinLength(1)
        .setMaxLength(8)
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(inputAco));
      await interaction.showModal(modal);
    }

    // BOTÃO: REGISTRAR VENDA
    if (interaction.customId === 'btn_venda') {
      const modal = new ModalBuilder()
        .setCustomId('modal_venda')
        .setTitle('💰 Registrar Venda no Arsenal');

      const inputArma = new TextInputBuilder()
        .setCustomId('arma_id')
        .setLabel('ID do Equipamento (Ex: ak47, awp, m16)')
        .setPlaceholder('Consulte os IDs na tabela')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const inputQtd = new TextInputBuilder()
        .setCustomId('qtd_venda')
        .setLabel('Quantidade vendida')
        .setPlaceholder('Ex: 2')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputArma),
        new ActionRowBuilder().addComponents(inputQtd)
      );
      await interaction.showModal(modal);
    }

    // BOTÃO: PERFIL / METAS
    if (interaction.customId === 'btn_perfil') {
      await interaction.deferReply({ ephemeral: true });
      const totalFarmado = obterAcoTotalMembro(user.id);
      const meta = db.config.META_ACO_KG || 8000;
      const batida = totalFarmado >= meta;

      const embedPerfil = new EmbedBuilder()
        .setTitle(`👤 OPERACIONAL • ${user.username}`)
        .setColor(batida ? '#22c55e' : '#a855f7')
        .setDescription('Acompanhamento pessoal de sua meta de aço semanal.')
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          { name: '⛓️ Seu Aço Acumulado', value: `\`\`\`${formatarNumero(totalFarmado)} kg\`\`\``, inline: true },
          { name: '🎯 Meta Semanal', value: `\`\`\`${formatarNumero(meta)} kg\`\`\``, inline: true },
          { name: '🏆 Status', value: batida ? '💚 **META BATIDA**' : '❌ **EM PROGRESSO**', inline: true }
        )
        .setFooter({ text: 'Hunters ERP • Sorte aos Fortes' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embedPerfil] });
    }

    // BOTÃO: TABELA DE PREÇOS
    if (interaction.customId === 'btn_arsenal') {
      await interaction.deferReply({ ephemeral: true });

      const embedArsenal = new EmbedBuilder()
        .setTitle('🔫 TABELA DE PREÇOS E REQUISITOS - ARSENAL')
        .setColor('#a855f7')
        .setDescription('Use os IDs abaixo ao registrar vendas de equipamentos.');

      let listaItens = "";
      Object.keys(ARMAS).forEach((key) => {
        const item = ARMAS[key];
        listaItens += `🔑 \`${key}\` | **${item.nome}**\n💵 Preço: \`${formatarMoeda(item.preco)}\` | ⛓️ Aço: \`${formatarNumero(item.aco)} kg\`\n\n`;
      });

      embedArsenal.addFields({ name: 'Itens Registrados', value: listaItens });
      await interaction.editReply({ embeds: [embedArsenal] });
    }

    // BOTÃO: RANKING DE FARME
    if (interaction.customId === 'btn_ranking') {
      await interaction.deferReply({ ephemeral: true });

      const totais = {};
      db.farmes.forEach(f => {
        totais[f.userId] = (totais[f.userId] || 0) + f.quantidade;
      });

      const rankingOrdenado = Object.keys(totais)
        .map(id => ({ userId: id, total: totais[id] }))
        .sort((a, b) => b.total - a.total);

      const embedRank = new EmbedBuilder()
        .setTitle('🏆 RANKING DE FARMERS - CLÃ HUNTERS')
        .setColor('#a855f7')
        .setDescription('Membros com maior engajamento no depósito de aço tático.');

      if (rankingOrdenado.length === 0) {
        embedRank.setDescription('Nenhum depósito cadastrado no ciclo atual.');
      } else {
        let txt = "";
        rankingOrdenado.slice(0, 10).forEach((item, index) => {
          const medalha = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
          txt += `${medalha} **${index + 1}°** - <@${item.userId}> : \`${formatarNumero(item.total)} kg\`\n`;
        });
        embedRank.addFields({ name: 'Top 10 Colaboradores', value: txt });
      }

      await interaction.editReply({ embeds: [embedRank] });
    }

    // BOTÃO: PAINEL ADMIN (ESTREITAMENTE PRIVADO E RESTRITO!)
    if (interaction.customId === 'btn_admin') {
      // CORREÇÃO: Usando verificação de administrador explícita no membro para segurança total!
      if (!interaction.member || !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ 
          content: '❌ **Acesso Negado:** Apenas administradores do servidor com cargo de gestão possuem permissão de configurar o painel.', 
          ephemeral: true 
        });
      }

      const modalConfig = new ModalBuilder()
        .setCustomId('modal_admin')
        .setTitle('⚙️ Configurações Hunters ERP');

      const inputMeta = new TextInputBuilder()
        .setCustomId('cfg_meta')
        .setLabel('Meta de Aço Semanal (em kg)')
        .setValue((db.config.META_ACO_KG || 8000).toString())
        .setStyle(TextInputStyle.Short);

      const inputSplit = new TextInputBuilder()
        .setCustomId('cfg_split')
        .setLabel('Split Membro % (Ex: 30)')
        .setValue((db.config.SPLIT_CLAN_PERCENT || 30).toString())
        .setStyle(TextInputStyle.Short);

      const inputCanalAvisos = new TextInputBuilder()
        .setCustomId('cfg_canal_avisos')
        .setLabel('ID Canal de Avisos de Metas')
        .setValue(db.config.CANAL_AVISOS_ID)
        .setStyle(TextInputStyle.Short);

      const inputCargo = new TextInputBuilder()
        .setCustomId('cfg_cargo')
        .setLabel('ID Cargo Notificar')
        .setValue(db.config.CARGO_NOTIFICAR_ID)
        .setStyle(TextInputStyle.Short);

      modalConfig.addComponents(
        new ActionRowBuilder().addComponents(inputMeta),
        new ActionRowBuilder().addComponents(inputSplit),
        new ActionRowBuilder().addComponents(inputCanalAvisos),
        new ActionRowBuilder().addComponents(inputCargo)
      );

      await interaction.showModal(modalConfig);
    }
  }

  // ENVIO DE MODAIS
  if (interaction.type === InteractionType.ModalSubmit) {
    
    // MODAL: ENVIAR FARME
    if (interaction.customId === 'modal_farme') {
      await interaction.deferReply({ ephemeral: true });
      const qtdAco = parseInt(interaction.fields.getTextInputValue('qtd_aco'));

      if (isNaN(qtdAco) || qtdAco <= 0) {
        return interaction.editReply({ content: '❌ **Número Inválido:** Digite uma quantidade inteira positiva de aço.' });
      }

      const totalAcoAnterior = obterAcoTotalMembro(user.id);
      
      db.farmes.push({
        userId: user.id,
        userName: user.username,
        quantidade: qtdAco,
        data: new Date().toISOString()
      });

      db.estoque += qtdAco;
      recalcularEstoqueDividido();
      salvarBanco();

      const totalAcoNovo = obterAcoTotalMembro(user.id);

      await interaction.editReply({ content: `✅ **Sucesso!** Registrado o depósito de **${formatarNumero(qtdAco)} kg** de aço tático.` });

      await verificarMetaAtingida(user.id, user.username, totalAcoAnterior, totalAcoNovo, guild);
      await atualizarPainel(guild);
    }

    // MODAL: REGISTRAR VENDA
    if (interaction.customId === 'modal_venda') {
      await interaction.deferReply({ ephemeral: true });
      const armaId = interaction.fields.getTextInputValue('arma_id').toLowerCase().trim();
      const qtd = parseInt(interaction.fields.getTextInputValue('qtd_venda'));

      if (!ARMAS[armaId]) {
        return interaction.editReply({ content: `❌ **ID do item inválido!** IDs válidos: \`ak47\`, \`awp\`, \`m16\`, \`sawnoff\`, etc.` });
      }

      if (isNaN(qtd) || qtd <= 0) {
        return interaction.editReply({ content: '❌ **Quantidade Inválida:** Por favor, digite uma quantidade válida.' });
      }

      const item = ARMAS[armaId];
      const acoTotalNecessario = item.aco * qtd;
      const valorVendaTotal = item.preco * qtd;

      if (db.estoque < acoTotalNecessario) {
        return interaction.editReply({ content: `❌ **Estoque insuficiente de Aço!** Necessário: \`${formatarNumero(acoTotalNecessario)} kg\`. Disponível: \`${formatarNumero(db.estoque)} kg\`.` });
      }

      const totalAcoAnterior = obterAcoTotalMembro(user.id);

      db.estoque -= acoTotalNecessario;
      db.caixa += valorVendaTotal;
      recalcularEstoqueDividido();

      db.vendas.push({
        userId: user.id,
        userName: user.username,
        itemKey: armaId,
        itemName: item.nome,
        quantidade: qtd,
        acoConsumido: acoTotalNecessario,
        total: valorVendaTotal,
        data: new Date().toISOString()
      });

      salvarBanco();

      const totalAcoNovo = obterAcoTotalMembro(user.id);

      await interaction.editReply({
        content: `✅ **Venda Registrada com Sucesso!**\n📦 **Item:** \`${item.nome}\` (${qtd}x)\n⛓️ **Aço de Venda Consumido:** \`${formatarNumero(acoTotalNecessario)} kg\`\n💰 **Faturamento total:** \`${formatarMoeda(valorVendaTotal)}\` depositado no cofre!`
      });

      await verificarMetaAtingida(user.id, user.username, totalAcoAnterior, totalAcoNovo, guild);
      await atualizarPainel(guild);
    }

    // MODAL: CONFIGURAÇÃO DE ADMIN
    if (interaction.customId === 'modal_admin') {
      await interaction.deferReply({ ephemeral: true });
      
      // Verificação dupla de permissão por segurança!
      if (!interaction.member || !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({ content: '❌ **Acesso Negado:** Sem privilégios de Administrador.' });
      }

      const novaMeta = parseInt(interaction.fields.getTextInputValue('cfg_meta'));
      const novoSplit = parseInt(interaction.fields.getTextInputValue('cfg_split'));
      const novoCanal = interaction.fields.getTextInputValue('cfg_canal_avisos');
      const novoCargo = interaction.fields.getTextInputValue('cfg_cargo');

      if (!isNaN(novaMeta) && novaMeta > 0) db.config.META_ACO_KG = novaMeta;
      if (!isNaN(novoSplit) && novoSplit >= 0 && novoSplit <= 100) db.config.SPLIT_CLAN_PERCENT = novoSplit;
      if (novoCanal) db.config.CANAL_AVISOS_ID = novoCanal;
      if (novoCargo) db.config.CARGO_NOTIFICAR_ID = novoCargo;

      salvarBanco();
      await interaction.editReply({ content: '⚙️ **Configurações atualizadas com sucesso!** O painel do Discord foi sincronizado.' });
      await atualizarPainel(guild);
    }
  }
});

// INICIALIZANDO CONEXÃO COM O BOT TOKEN
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error("❌ [HUNTERS] Falha crítica de conexão. Verifique o DISCORD_TOKEN no seu arquivo .env!", err.message);
});
