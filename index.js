/**
 * =========================================================================
 * ⚔️ CLÃ HUNTERS - BOT DE GERENCIAMENTO ERP STANDALONE (Discord.js v14) ⚔️
 * =========================================================================
 *
 * Versão Ultra Moderna e Sincronizada com Interações por Botões e Modais do Discord.
 * Adaptada para o Sistema de KIT DA META (8.000 Aços de Meta, 3.260 Aços por Kit).
 *
 * ⚙️ CONFIGURAÇÕES DE HOSPEDAGEM:
 * 1. Requer Node.js v16.9.0 ou superior.
 * 2. Instalação: npm install discord.js dotenv
 * 3. Configure o arquivo .env:
 *    - DISCORD_TOKEN=Seu_Token_Do_Bot (ou use a variável TOKEN no seu painel)
 *    - PREFIX=!
 *
 * 🔒 CONTROLE DE ACESSO:
 * - Apenas membros com o cargo ID "1523277774436171796" (ou administradores)
 *   podem adicionar ou retirar aço do estoque.
 */

require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ActivityType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// Inicialização do Client do Discord com os Intents necessários
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const PREFIX = process.env.PREFIX || '!';
const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
const DB_FILE = path.join(__dirname, 'hunters_database.json');

// ID do Cargo autorizado a colocar e retirar estoque
const CARGO_ESTOQUE_ID = '1523277774436171796';

// Estado Inicial do Banco de Dados
let db = {
  estoque: 69000,         // Aço total do baú em kg
  estoqueKits: 20700,     // Aço reservado para Kits (30% padrão)
  estoqueVendas: 48300,   // Aço reservado para Vendas (70% padrão)
  caixa: 280000,          // R$ 280.000 padrão
  vendas: [],
  kitsEntregues: [],      // Histórico de Kits entregues aos membros
  config: {
    splitPercent: 30,           // % de comissão do vendedor (membro)
    steelClanPercent: 10,       // % de retenção de aço pro clã
    kitCost: 3260,              // Custo em kg do Kit de Meta
    percentSteelForKits: 30,    // % de aço destinado a Kits
    percentSteelForSales: 70,   // % de aço destinado a Vendas de Armas
    kitMeta: {
      meta: 8000,               // Meta necessária em aços
      custo: 3260,              // Custo real do kit da meta (3.260 Aços)
      itens: {
        ak47: { nome: "AK-47", quantidade: 1, aco: 2700 },
        glock17: { nome: "Glock 17", quantidade: 1, aco: 120 },
        box556: { nome: "Box 5.56", quantidade: 3, aco: 360 },
        boxPistola: { nome: "Box Pistola", quantidade: 2, aco: 80 }
      }
    }
  }
};

// Armamentos Cadastrados no ERP HUNTERS
const ARMAS = {
  'ak47': { nome: "AK-47", preco: 250000, aco: 2700, icon: "🔫" },
  'awp': { nome: "AWP Sniper", preco: 500000, aco: 3000, icon: "🎯" },
  'm16': { nome: "M16", preco: 230000, aco: 2700, icon: "⚔️" },
  'sawedoff': { nome: "Sawed-Off", preco: 120000, aco: 1200, icon: "💥" },
  'glock17': { nome: "Glock 17", preco: 15000, aco: 120, icon: "🔫" }
};

// Carregar banco de dados ou criar novo
function carregarBanco() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const dados = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(dados);
      console.log('📦 [HUNTERS] Banco de dados carregado com sucesso!');
      
      // Sincronizar e injetar configurações e novas chaves caso ausentes
      if (!db.config) db.config = {};
      if (db.config.percentSteelForKits === undefined) db.config.percentSteelForKits = 30;
      if (db.config.percentSteelForSales === undefined) db.config.percentSteelForSales = 70;
      if (db.config.splitPercent === undefined) db.config.splitPercent = 30;
      if (db.kitsEntregues === undefined) db.kitsEntregues = [];
      if (db.farmes === undefined) db.farmes = [];
      
      if (db.config.kitMeta === undefined) {
        db.config.kitMeta = {
          meta: 8000,
          custo: 3260,
          itens: {
            ak47: { nome: "AK-47", quantidade: 1, aco: 2700 },
            glock17: { nome: "Glock 17", quantidade: 1, aco: 120 },
            box556: { nome: "Box 5.56", quantidade: 3, aco: 360 },
            boxPistola: { nome: "Box Pistola", quantidade: 2, aco: 80 }
          }
        };
      }
      
      // Manter custo do kit sincronizado
      db.config.kitCost = db.config.kitMeta.custo;

      if (db.estoqueKits === undefined || db.estoqueVendas === undefined) {
        db.estoqueKits = Math.floor(db.estoque * (db.config.percentSteelForKits / 100));
        db.estoqueVendas = db.estoque - db.estoqueKits;
        salvarBanco();
      }
    } else {
      salvarBanco();
      console.log('📦 [HUNTERS] Novo arquivo de banco de dados criado!');
    }
  } catch (erro) {
    console.error('❌ Erro ao carregar banco de dados:', erro);
  }
}

function salvarBanco() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (erro) {
    console.error('❌ Erro ao salvar banco de dados:', erro);
  }
}

// Helpers de formatação
const formatarMoeda = (valor) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
};

const formatarNumero = (num) => {
  return new Intl.NumberFormat('pt-BR').format(num);
};

// Helper para verificar autorização (Cargo específico ou Administrador)
const temPermissaoEstoque = (member) => {
  if (!member) return false;
  return member.roles.cache.has(CARGO_ESTOQUE_ID) || member.permissions.has('Administrator');
};

// Obter quantidade de Kits da Meta disponíveis no estoque reservado
function calcularKitsDisponiveis() {
  const custo = (db.config && db.config.kitMeta && db.config.kitMeta.custo) ? db.config.kitMeta.custo : 3260;
  const estoqueKits = db.estoqueKits !== undefined ? db.estoqueKits : Math.floor(db.estoque * 0.3);
  return Math.floor(estoqueKits / custo);
}

// Obter o Embed de Metas de Aço (8.000 kg semanal por pessoa)
const obterMetasEmbed = () => {
  const statsMap = {};
  
  // Agrupar aço consumido por usuário em vendas
  db.vendas.forEach(v => {
    const key = v.userName || 'Membro Antigo';
    if (!statsMap[key]) {
      statsMap[key] = { aco: 0, count: 0 };
    }
    statsMap[key].aco += (v.acoConsumido || 0);
    statsMap[key].count++;
  });

  // Agrupar aço de farmes diários
  if (db.farmes) {
    db.farmes.forEach(f => {
      const key = f.userName || 'Membro Antigo';
      if (!statsMap[key]) {
        statsMap[key] = { aco: 0, count: 0 };
      }
      statsMap[key].aco += (f.quantidade || 0);
    });
  }

  let list = "";
  Object.entries(statsMap).forEach(([userName, stats]) => {
    const percent = Math.min(100, Math.floor((stats.aco / 8000) * 100));
    const numBlocks = Math.min(10, Math.floor(percent / 10));
    const bar = "█".repeat(numBlocks) + "░".repeat(10 - numBlocks);
    const achieved = stats.aco >= 8000 ? "🎉 **META BATIDA!**" : `${percent}%`;
    list += `👤 **${userName}**: \`${bar}\` **${formatarNumero(stats.aco)}** / 8.000 kg (${achieved})\n`;
  });

  const embedMetas = new EmbedBuilder()
    .setTitle('🎯 METAS DE AÇO — FACÇÃO HUNTERS')
    .setDescription(`Meta individual semanal de faturar/consumir **8.000 kg** de aço por pessoa:\n\n${list || 'Nenhuma venda registrada ainda para calcular as metas.'}`)
    .setColor('#a855f7')
    .setTimestamp();

  return embedMetas;
};

// Evento Ready
client.once('ready', () => {
  console.log(`🤖 [HUNTERS] Bot online como ${client.user.tag}!`);
  carregarBanco();
  
  // Status personalizado e elegante
  client.user.setPresence({
    activities: [{ 
      name: '💀 Operações HUNTERS | !ajuda', 
      type: ActivityType.Competing 
    }],
    status: 'dnd'
  });
});

// Enviar o Painel Operacional Central
const enviarPainelCentral = (channel, targetUser = null) => {
  const acoKits = db.estoqueKits !== undefined ? db.estoqueKits : Math.floor(db.estoque * ((db.config.percentSteelForKits || 30) / 100));
  const acoVendas = db.estoqueVendas !== undefined ? db.estoqueVendas : (db.estoque - acoKits);
  const kitsProntos = calcularKitsDisponiveis();
  const totalVendido = db.vendas.reduce((acc, v) => acc + v.total, 0);
  const split = db.config.splitPercent;
  const metaIndividual = db.config.kitMeta?.meta ?? 8000;
  const custoKit = db.config.kitCost ?? 3260;

  // Calcular estatísticas dinâmicas para o painel
  const statsMap = {};
  db.vendas.forEach(v => {
    const key = v.userId;
    if (!statsMap[key]) {
      statsMap[key] = { aco: 0 };
    }
    statsMap[key].aco += v.aco;
  });
  if (db.farmes) {
    db.farmes.forEach(f => {
      const key = f.userId;
      if (!statsMap[key]) {
        statsMap[key] = { aco: 0 };
      }
      statsMap[key].aco += (f.quantidade || 0);
    });
  }
  const metasBatidas = Object.values(statsMap).filter(s => s.aco >= metaIndividual).length;
  const kitsEntregues = db.kitsEntregues ? db.kitsEntregues.length : 0;
  const vendasRegistradas = db.vendas ? db.vendas.length : 0;

  const formatarLinhaBox = (prefix, valor) => {
    let visualLen = 0;
    for (let i = 0; i < prefix.length; i++) {
      const code = prefix.charCodeAt(i);
      if (code >= 0xD800 && code <= 0xDBFF) {
        visualLen += 2;
        i++;
      } else if (code === 0xFE0F) {
        // variation selector
      } else if (code === 0x26D3 || code === 0x23F1) {
        visualLen += 2;
      } else {
        visualLen += 1;
      }
    }
    const targetCol = 27;
    const spacesBeforeColon = Math.max(1, targetCol - visualLen);
    const part1 = prefix + ' '.repeat(spacesBeforeColon) + ':: ';
    
    let part1AndValueLen = targetCol + 3;
    for (let i = 0; i < valor.length; i++) {
      part1AndValueLen += 1;
    }
    const spacesAfterValue = Math.max(0, 56 - part1AndValueLen);
    return part1 + valor + ' '.repeat(spacesAfterValue) + '│';
  };

  const formatarLinhaSimples = (texto) => {
    let visualLen = 0;
    for (let i = 0; i < texto.length; i++) {
      const code = texto.charCodeAt(i);
      if (code >= 0xD800 && code <= 0xDBFF) {
        visualLen += 2;
        i++;
      } else if (code === 0xFE0F) {
        // variation selector
      } else if (code === 0x26D3 || code === 0x23F1) {
        visualLen += 2;
      } else {
        visualLen += 1;
      }
    }
    const spacesAfter = Math.max(0, 56 - visualLen);
    return texto + ' '.repeat(spacesAfter) + '│';
  };

  const formatarMoedaResumida = (valor) => {
    return "R$ " + formatarNumero(Math.floor(valor));
  };

  let painelTexto = "```\n";
  painelTexto += "                    ╔══════════════════════════════════════════╗\n";
  painelTexto += "                    ║                                          ║\n";
  painelTexto += "                    ║              🐺 HUNTERS ERP              ║\n";
  painelTexto += "                    ║         Premium Management • v4.0        ║\n";
  painelTexto += "                    ║                                          ║\n";
  painelTexto += "                    ╚══════════════════════════════════════════╝\n\n";

  painelTexto += "╭━━━━━━━━━━━━━━━━━━━━━━ 📦 ESTOQUE ━━━━━━━━━━━━━━━━━━━━━━╮\n";
  painelTexto += formatarLinhaBox("│ ⛓️ Aço Total", `${formatarNumero(db.estoque)} kg`) + "\n";
  painelTexto += formatarLinhaBox("│ 🔫 Aço para Vendas", `${formatarNumero(acoVendas)} kg (${db.config.percentSteelForSales || 70}%)`) + "\n";
  painelTexto += formatarLinhaBox("│ 🎁 Aço para Kits", `${formatarNumero(acoKits)} kg (${db.config.percentSteelForKits || 30}%)`) + "\n";
  painelTexto += formatarLinhaBox("│ 📦 Kits Disponíveis", `${formatarNumero(kitsProntos)} Kits`) + "\n";
  painelTexto += "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n";

  painelTexto += "╭━━━━━━━━━━━━━━━━━━━━━━ 💰 FINANCEIRO ━━━━━━━━━━━━━━━━━━━╮\n";
  painelTexto += formatarLinhaBox("│ 🏦 Caixa do Clã", formatarMoedaResumida(db.caixa)) + "\n";
  painelTexto += formatarLinhaBox("│ 💵 Total Vendido", formatarMoedaResumida(totalVendido)) + "\n";
  painelTexto += formatarLinhaBox("│ 📈 Lucro do Clã", `${100 - split}%`) + "\n";
  painelTexto += formatarLinhaBox("│ 💸 Comissão", `${split}%`) + "\n";
  painelTexto += "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n";

  painelTexto += "╭━━━━━━━━━━━━━━━━━━━━━━ 🎯 META DA SEMANA ━━━━━━━━━━━━━━━╮\n";
  painelTexto += formatarLinhaBox("│ 🏆 Objetivo", `${formatarNumero(metaIndividual)} Aços`) + "\n";
  painelTexto += formatarLinhaSimples("│") + "\n";
  painelTexto += formatarLinhaSimples("│ 🎁 RECOMPENSA") + "\n";
  painelTexto += formatarLinhaSimples("│") + "\n";
  painelTexto += formatarLinhaSimples("│ 🔫 AK-47 x1") + "\n";
  painelTexto += formatarLinhaSimples("│ 🔫 Glock 17 x1") + "\n";
  painelTexto += formatarLinhaSimples("│ 📦 Box 5.56 x3") + "\n";
  painelTexto += formatarLinhaSimples("│ 📦 Box Pistola x2") + "\n";
  painelTexto += "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n";

  const historicoCount = db.vendas.length + (db.farmes ? db.farmes.length : 0) + (db.kitsEntregues ? db.kitsEntregues.length : 0);

  painelTexto += "╭━━━━━━━━━━━━━━━━━━━━━━ 📊 ESTATÍSTICAS ━━━━━━━━━━━━━━━━━╮\n";
  painelTexto += formatarLinhaBox("│ 👥 Metas Batidas", String(metasBatidas)) + "\n";
  painelTexto += formatarLinhaBox("│ 🎁 Kits Entregues", String(kitsEntregues)) + "\n";
  painelTexto += formatarLinhaBox("│ 🛒 Vendas Registradas", String(vendasRegistradas)) + "\n";
  painelTexto += formatarLinhaBox("│ 📜 Histórico", String(historicoCount)) + "\n";
  painelTexto += "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n";

  painelTexto += "╭━━━━━━━━━━━━━━━━━━━━━━ ⚡ STATUS DO SISTEMA ━━━━━━━━━━━━━╮\n";
  painelTexto += formatarLinhaSimples("│ 🟢 Sistema Online") + "\n";
  painelTexto += formatarLinhaSimples("│ 🔒 ERP Sincronizado") + "\n";
  painelTexto += formatarLinhaSimples("│ 💾 Banco de Dados Conectado") + "\n";
  painelTexto += formatarLinhaSimples("│ ⏱️ Atualização em Tempo Real") + "\n";
  painelTexto += "╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n";

  painelTexto += "                 🐺 HUNTERS BOT • ERP PREMIUM • v4.0\n";
  painelTexto += "               Desenvolvido para o Clã HUNTERS ©\n";
  painelTexto += "```";

  const embedPainel = new EmbedBuilder()
    .setDescription(painelTexto)
    .setColor('#a855f7')
    .setTimestamp();

  // Botões de Interação de cor Roxa (ButtonStyle.Primary)
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('painel_estoque')
      .setLabel('📦 Consultar Estoque')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('painel_caixa')
      .setLabel('🏦 Caixa')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('painel_registrar_meta')
      .setLabel('🎯 Registrar Meta')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('painel_addaco')
      .setLabel('➕ Adicionar Aço')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('painel_subaco')
      .setLabel('➖ Retirar Aço')
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('painel_venda')
      .setLabel('💰 Registrar Venda')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('painel_kits')
      .setLabel('🎁 Kits Meta')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('painel_ranking')
      .setLabel('🏆 Ranking')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('painel_metas')
      .setLabel('🎯 Metas Aço')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('painel_historico')
      .setLabel('📜 Histórico')
      .setStyle(ButtonStyle.Primary)
  );

  const content = targetUser ? `||${targetUser}||` : undefined;

  channel.send({
    content: content,
    embeds: [embedPainel],
    components: [row1, row2]
  });
};

// Evento de Mensagem (Comandos via Chat)
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // COMANDO !painel
  if (command === 'painel') {
    enviarPainelCentral(message.channel);
    try { message.delete(); } catch(e) {}
  }

  // COMANDO !ajuda
  if (command === 'ajuda') {
    const embedAjuda = new EmbedBuilder()
      .setTitle('🐺 SISTEMA DE AJUDA — HUNTERS ERP v4.0')
      .setDescription('Use o painel central interativo ou os comandos abaixo:')
      .addFields(
        { name: '`!painel`', value: 'Envia o painel interativo de controle.' },
        { name: '`!estoque [quantidade]`', value: 'Define o aço total do baú (Requer Cargo Autorizado).' },
        { name: '`!addaco [quantidade]`', value: 'Adiciona aço ao estoque (Requer Cargo Autorizado).' },
        { name: '`!subaco [quantidade]`', value: 'Remove aço do estoque (Requer Cargo Autorizado).' },
        { name: '`!caixa [quantidade]`', value: 'Define o dinheiro atual do caixa.' },
        { name: '`!vender [membro] [arma] [quantidade]`', value: 'Registra uma venda, calcula comissão e retém o aço do clã.' },
        { name: '`!entregarkit [membro]`', value: 'Entrega um kit de meta a um membro (gasta 3.260 kg de aço reservado).' },
        { name: '`!farme [membro] [quantidade]`', value: 'Registra farme diário de aço direto para o estoque.' },
        { name: '`!limpar`', value: 'Limpa o histórico de vendas (Requer Admin).' }
      )
      .setColor('#a855f7')
      .setFooter({ text: 'HUNTERS BOT v4.0 ©' });

    message.reply({ embeds: [embedAjuda] });
  }

  // COMANDO !estoque
  if (command === 'estoque') {
    if (!temPermissaoEstoque(message.member)) {
      return message.reply('❌ Você não tem permissão para alterar o estoque.');
    }
    const quant = parseInt(args[0]);
    if (isNaN(quant)) return message.reply('❌ Uso correto: `!estoque [quantidade]`');
    
    db.estoque = quant;
    db.estoqueKits = Math.floor(quant * (db.config.percentSteelForKits / 100));
    db.estoqueVendas = quant - db.estoqueKits;
    salvarBanco();
    message.reply(`✅ Estoque total reajustado para **${formatarNumero(quant)} kg** (Vendas: ${formatarNumero(db.estoqueVendas)} kg | Kits: ${formatarNumero(db.estoqueKits)} kg).`);
  }

  // COMANDO !addaco
  if (command === 'addaco') {
    if (!temPermissaoEstoque(message.member)) {
      return message.reply('❌ Você não tem permissão para alterar o estoque.');
    }
    const quant = parseInt(args[0]);
    if (isNaN(quant) || quant <= 0) return message.reply('❌ Uso correto: `!addaco [quantidade]`');

    db.estoque += quant;
    const addKits = Math.floor(quant * (db.config.percentSteelForKits / 100));
    const addVendas = quant - addKits;

    db.estoqueKits += addKits;
    db.estoqueVendas += addVendas;
    
    salvarBanco();
    message.reply(`✅ Adicionados **${formatarNumero(quant)} kg** de aço ao baú! (${db.config.percentSteelForKits}% destinado a Kits, ${db.config.percentSteelForSales}% a Vendas)`);
  }

  // COMANDO !subaco
  if (command === 'subaco') {
    if (!temPermissaoEstoque(message.member)) {
      return message.reply('❌ Você não tem permissão para alterar o estoque.');
    }
    const quant = parseInt(args[0]);
    if (isNaN(quant) || quant <= 0) return message.reply('❌ Uso correto: `!subaco [quantidade]`');

    if (db.estoque < quant) return message.reply('❌ Estoque insuficiente!');

    db.estoque -= quant;
    const subKits = Math.floor(quant * (db.config.percentSteelForKits / 100));
    const subVendas = quant - subKits;

    db.estoqueKits = Math.max(0, db.estoqueKits - subKits);
    db.estoqueVendas = Math.max(0, db.estoqueVendas - subVendas);

    salvarBanco();
    message.reply(`✅ Retirados **${formatarNumero(quant)} kg** de aço do baú.`);
  }

  // COMANDO !caixa
  if (command === 'caixa') {
    const quant = parseInt(args[0]);
    if (isNaN(quant)) return message.reply('❌ Uso correto: `!caixa [quantidade]`');
    db.caixa = quant;
    salvarBanco();
    message.reply(`✅ Caixa do Clã atualizado para **${formatarMoeda(quant)}**`);
  }

  // COMANDO !limpar
  if (command === 'limpar') {
    if (!message.member.permissions.has('Administrator')) {
      return message.reply('❌ Apenas Administradores podem limpar o histórico.');
    }
    db.vendas = [];
    db.farmes = [];
    db.kitsEntregues = [];
    salvarBanco();
    message.reply('🧹 Todo o histórico do ERP foi limpo com sucesso.');
  }

  // COMANDO !farme
  if (command === 'farme') {
    const targetUser = message.mentions.users.first();
    const quant = parseInt(args[1]);
    if (!targetUser || isNaN(quant) || quant <= 0) {
      return message.reply('❌ Uso correto: `!farme [@membro] [quantidade]`');
    }

    if (!db.farmes) db.farmes = [];
    db.farmes.push({
      userId: targetUser.id,
      userName: targetUser.username,
      quantidade: quant,
      data: new Date().toLocaleDateString('pt-BR')
    });

    db.estoque += quant;
    const addKits = Math.floor(quant * (db.config.percentSteelForKits / 100));
    const addVendas = quant - addKits;
    db.estoqueKits += addKits;
    db.estoqueVendas += addVendas;

    salvarBanco();
    message.reply(`⛏️ **Farme Registrado!** **${targetUser.username}** enviou **${formatarNumero(quant)} kg** de aço direto para o estoque!`);
  }

  // COMANDO !entregarkit
  if (command === 'entregarkit') {
    const targetUser = message.mentions.users.first();
    if (!targetUser) {
      return message.reply('❌ Uso correto: `!entregarkit [@membro]`');
    }

    const custo = db.config.kitMeta.custo; // 3.260
    if (db.estoqueKits < custo) {
      return message.reply(`❌ Estoque de Kits insuficiente! Necessário **${formatarNumero(custo)} kg** de aço reservado para kits (Atual: ${formatarNumero(db.estoqueKits)} kg).`);
    }

    db.estoqueKits -= custo;
    db.estoque -= custo;
    db.kitsEntregues.push({
      userId: targetUser.id,
      userName: targetUser.username,
      data: new Date().toLocaleDateString('pt-BR')
    });

    salvarBanco();

    const embedKit = new EmbedBuilder()
      .setTitle('🎁 KIT META SEMANAL ENTREGUE!')
      .setDescription(`O administrador enviou o Kit para **${targetUser.username}**!`)
      .addFields(
        { name: '🎁 Itens Inclusos', value: '🔫 AK-47 x1\n🔫 Glock 17 x1\n📦 Box 5.56 x3\n📦 Box Pistola x2' },
        { name: '📉 Custo do Kit', value: `\`${formatarNumero(custo)} kg\` de aço consumidos da Reserva.` }
      )
      .setColor('#10b981')
      .setTimestamp();

    message.reply({ embeds: [embedKit] });
  }

  // COMANDO !vender
  if (command === 'vender') {
    const targetUser = message.mentions.users.first() || message.author;
    const armaKey = args[1]?.toLowerCase();
    const quant = parseInt(args[2]) || 1;

    if (!armaKey || !ARMAS[armaKey]) {
      return message.reply(`❌ Uso correto: \`!vender [@membro] [${Object.keys(ARMAS).join('/')}] [quantidade]\``);
    }

    const arma = ARMAS[armaKey];
    const valorVenda = arma.preco * quant;
    const acoConsumido = arma.aco * quant;

    if (db.estoqueVendas < acoConsumido) {
      return message.reply(`❌ Estoque reservado para vendas insuficiente! Necessário **${formatarNumero(acoConsumido)} kg** de aço para fabricar as armas.`);
    }

    // Divisão de lucros
    const split = db.config.splitPercent;
    const comissaoMembro = valorVenda * (split / 100);
    const lucroClan = valorVenda - comissaoMembro;

    // Ajustes de Estoque e Caixa
    db.estoqueVendas -= acoConsumido;
    db.estoque -= acoConsumido;
    db.caixa += lucroClan;

    db.vendas.push({
      userId: targetUser.id,
      userName: targetUser.username,
      arma: arma.nome,
      quantidade: quant,
      total: valorVenda,
      comissao: comissaoMembro,
      aco: acoConsumido,
      data: new Date().toLocaleDateString('pt-BR')
    });

    salvarBanco();

    const embedVenda = new EmbedBuilder()
      .setTitle('🛒 VENDA REGISTRADA COM SUCESSO')
      .setDescription(`Armas fabricadas e vendidas com sucesso para a facção!`)
      .addFields(
        { name: '👤 Vendedor', value: `${targetUser.username}`, inline: true },
        { name: '🔫 Armas Vendidas', value: `${arma.icon} ${quant}x ${arma.nome}`, inline: true },
        { name: '💰 Total Venda', value: `**${formatarMoeda(valorVenda)}**`, inline: true },
        { name: '🏦 Lucro Clã', value: `\`${formatarMoeda(lucroClan)}\` (${100 - split}%)`, inline: true },
        { name: '💸 Comissão Membro', value: `\`${formatarMoeda(comissaoMembro)}\` (${split}%)`, inline: true },
        { name: '⛓️ Aço Consumido', value: `\`${formatarNumero(acoConsumido)} kg\` de Aço Vendas`, inline: true }
      )
      .setColor('#10b981')
      .setFooter({ text: 'HUNTERS BOT v4.0 ©' })
      .setTimestamp();

    message.reply({ embeds: [embedVenda] });
  }
});

// Evento de Clique nos Botões de Interação (Modais e Respostas)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const member = interaction.member;

  // 1. CONSULTAR ESTOQUE
  if (interaction.customId === 'painel_estoque') {
    const acoKits = db.estoqueKits !== undefined ? db.estoqueKits : Math.floor(db.estoque * 0.3);
    const acoVendas = db.estoqueVendas !== undefined ? db.estoqueVendas : (db.estoque - acoKits);
    const kitsProntos = calcularKitsDisponiveis();

    const embed = new EmbedBuilder()
      .setTitle('📦 RELATÓRIO DETALHADO DO ESTOQUE')
      .setDescription('Status real do aço armazenado no baú da facção:')
      .addFields(
        { name: '⛓️ Aço Total', value: `\`${formatarNumero(db.estoque)} kg\``, inline: false },
        { name: '🔫 Reserva para Vendas', value: `\`${formatarNumero(acoVendas)} kg\` (${db.config.percentSteelForSales || 70}%)`, inline: true },
        { name: '🎁 Reserva para Kits', value: `\`${formatarNumero(acoKits)} kg\` (${db.config.percentSteelForKits || 30}%)`, inline: true },
        { name: '📦 Kits de Metas Prontos', value: `**${formatarNumero(kitsProntos)} Kits** de Meta`, inline: false }
      )
      .setColor('#a855f7')
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // 2. CAIXA DO CLÃ
  if (interaction.customId === 'painel_caixa') {
    const totalVendido = db.vendas.reduce((acc, v) => acc + v.total, 0);
    const split = db.config.splitPercent;

    const embed = new EmbedBuilder()
      .setTitle('🏦 FLUXO FINANCEIRO DO CLÃ')
      .addFields(
        { name: '💰 Saldo em Caixa', value: `**${formatarMoeda(db.caixa)}**`, inline: false },
        { name: '🛒 Bruto Vendido (Histórico)', value: `\`${formatarMoeda(totalVendido)}\``, inline: true },
        { name: '📈 Divisão', value: `🏦 **${100 - split}%** Clã | 💸 **${split}%** Membro`, inline: true }
      )
      .setColor('#a855f7')
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // 3. REGISTRAR META (Apenas Admin/Cargo Autorizado)
  if (interaction.customId === 'painel_registrar_meta') {
    if (!temPermissaoEstoque(member)) {
      return interaction.reply({ content: '❌ Você não tem o cargo autorizado para entregar Kits de Meta semanal.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('modal_registrar_meta')
      .setTitle('🎯 Entregar Kit da Meta');

    const inputUser = new TextInputBuilder()
      .setCustomId('meta_user')
      .setLabel('ID do Membro (ou @Membro)')
      .setPlaceholder('Ex: @Maozinha ou ID Discord')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(inputUser));
    return interaction.showModal(modal);
  }

  // 4. ADICIONAR AÇO (Apenas Autorizado)
  if (interaction.customId === 'painel_addaco') {
    if (!temPermissaoEstoque(member)) {
      return interaction.reply({ content: '❌ Você não tem o cargo autorizado para alterar o estoque no Baú.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('modal_addaco')
      .setTitle('➕ Adicionar Aço ao Baú');

    const inputQtd = new TextInputBuilder()
      .setCustomId('addaco_quantidade')
      .setLabel('Quantidade de Aço (em kg)')
      .setPlaceholder('Ex: 5000')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(inputQtd));
    return interaction.showModal(modal);
  }

  // 5. RETIRAR AÇO (Apenas Autorizado)
  if (interaction.customId === 'painel_subaco') {
    if (!temPermissaoEstoque(member)) {
      return interaction.reply({ content: '❌ Você não tem o cargo autorizado para alterar o estoque no Baú.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('modal_subaco')
      .setTitle('➖ Retirar Aço do Baú');

    const inputQtd = new TextInputBuilder()
      .setCustomId('subaco_quantidade')
      .setLabel('Quantidade de Aço (em kg)')
      .setPlaceholder('Ex: 3000')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(inputQtd));
    return interaction.showModal(modal);
  }

  // 6. REGISTRAR VENDA
  if (interaction.customId === 'painel_venda') {
    const modal = new ModalBuilder()
      .setCustomId('modal_venda')
      .setTitle('💰 Registrar Venda de Armamentos');

    const inputArma = new TextInputBuilder()
      .setCustomId('venda_arma')
      .setLabel('Código da Arma')
      .setPlaceholder(`Ex: ak47, m16, glock17, awp, sawedoff`)
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const inputQtd = new TextInputBuilder()
      .setCustomId('venda_quantidade')
      .setLabel('Quantidade Vendida')
      .setPlaceholder('Ex: 1')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const inputUser = new TextInputBuilder()
      .setCustomId('venda_membro')
      .setLabel('Nome ou @ do Vendedor')
      .setPlaceholder('Deixe vazio para você mesmo')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(inputArma),
      new ActionRowBuilder().addComponents(inputQtd),
      new ActionRowBuilder().addComponents(inputUser)
    );
    return interaction.showModal(modal);
  }

  // 7. CONSULTAR RECOMPENSA DE KITS
  if (interaction.customId === 'painel_kits') {
    const meta = db.config.kitMeta.meta;
    const custo = db.config.kitMeta.custo;

    const embed = new EmbedBuilder()
      .setTitle('🎁 KIT COMPLETO DA META HUNTERS')
      .setDescription(`Para cada **${formatarNumero(meta)} kg** de aço acumulados, você ganha o Kit semanal!`)
      .addFields(
        { name: '🔫 Armamento Principal', value: '🔫 AK-47 x1', inline: true },
        { name: '🔫 Armamento Secundário', value: '🔫 Glock 17 x1', inline: true },
        { name: '📦 Suprimentos Extras', value: '📦 Box 5.56 x3\n📦 Box Pistola x2', inline: false },
        { name: '⚙️ Custo do Kit para a Facção', value: `\`${formatarNumero(custo)} kg\` de aço por entrega.`, inline: false }
      )
      .setColor('#a855f7')
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // 8. METAS GERAIS
  if (interaction.customId === 'painel_metas') {
    const embedMetas = obterMetasEmbed();
    return interaction.reply({ embeds: [embedMetas], ephemeral: true });
  }

  // 9. RANKING
  if (interaction.customId === 'painel_ranking') {
    const statsMap = {};
    db.vendas.forEach(v => {
      const key = v.userName || 'Membro';
      if (!statsMap[key]) statsMap[key] = { aco: 0, total: 0 };
      statsMap[key].aco += (v.acoConsumido || 0);
      statsMap[key].total += v.total;
    });

    if (db.farmes) {
      db.farmes.forEach(f => {
        const key = f.userName || 'Membro';
        if (!statsMap[key]) statsMap[key] = { aco: 0, total: 0 };
        statsMap[key].aco += (f.quantidade || 0);
      });
    }

    const ranking = Object.entries(statsMap)
      .sort((a, b) => b[1].aco - a[1].aco)
      .slice(0, 10);

    let rankList = "";
    ranking.forEach(([name, stats], index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "👤";
      rankList += `${medal} **${index + 1}º ${name}** — Fabricou/Entregou **${formatarNumero(stats.aco)} kg** (Vendas: ${formatarMoeda(stats.total)})\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🏆 RANKING DE PRODUTIVIDADE HUNTERS')
      .setDescription(rankList || 'Nenhum membro registrado no ranking ainda.')
      .setColor('#a855f7')
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // 10. HISTÓRICO
  if (interaction.customId === 'painel_historico') {
    const ultimasVendas = db.vendas.slice(-5).reverse();
    const ultimosKits = db.kitsEntregues ? db.kitsEntregues.slice(-3).reverse() : [];
    
    let logs = "**🛒 Últimas Vendas Registradas:**\n";
    if (ultimasVendas.length === 0) logs += "*Nenhuma venda recente.*\n";
    ultimasVendas.forEach(v => {
      logs += `• \`${v.data}\` - **${v.userName}** vendeu ${v.quantidade}x **${v.arma}** | Comissão: \`${formatarMoeda(v.comissao)}\`\n`;
    });

    logs += "\n**🎁 Últimas Entregas de Kits da Meta:**\n";
    if (ultimosKits.length === 0) logs += "*Nenhum kit entregue recentemente.*\n";
    ultimosKits.forEach(k => {
      logs += `• \`${k.data}\` - Kit Meta enviado para **${k.userName}**\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle('📜 ÚLTIMAS ATIVIDADES DO ERP')
      .setDescription(logs)
      .setColor('#a855f7')
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

// Resposta aos Envios de Modais
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  // MODAL: ADICIONAR AÇO
  if (interaction.customId === 'modal_addaco') {
    const qtdStr = interaction.fields.getTextInputValue('addaco_quantidade');
    const quant = parseInt(qtdStr);

    if (isNaN(quant) || quant <= 0) {
      return interaction.reply({ content: '❌ Erro: Por favor insira um número válido maior que zero.', ephemeral: true });
    }

    db.estoque += quant;
    const addKits = Math.floor(quant * (db.config.percentSteelForKits / 100));
    const addVendas = quant - addKits;

    db.estoqueKits += addKits;
    db.estoqueVendas += addVendas;
    
    salvarBanco();

    await interaction.reply({ content: `✅ Sucesso! **${formatarNumero(quant)} kg** adicionados ao baú.`, ephemeral: true });
    
    // Atualiza o painel operacional no canal atual
    try {
      interaction.channel.messages.fetch({ limit: 10 }).then(messages => {
        const botMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].description.includes('HUNTERS'));
        if (botMsg) {
          botMsg.delete();
          enviarPainelCentral(interaction.channel);
        }
      });
    } catch(e) {}
  }

  // MODAL: RETIRAR AÇO
  if (interaction.customId === 'modal_subaco') {
    const qtdStr = interaction.fields.getTextInputValue('subaco_quantidade');
    const quant = parseInt(qtdStr);

    if (isNaN(quant) || quant <= 0) {
      return interaction.reply({ content: '❌ Erro: Por favor insira um número válido maior que zero.', ephemeral: true });
    }

    if (db.estoque < quant) {
      return interaction.reply({ content: `❌ Erro: Estoque insuficiente! Baú atual tem apenas **${formatarNumero(db.estoque)} kg**.`, ephemeral: true });
    }

    db.estoque -= quant;
    const subKits = Math.floor(quant * (db.config.percentSteelForKits / 100));
    const subVendas = quant - subKits;

    db.estoqueKits = Math.max(0, db.estoqueKits - subKits);
    db.estoqueVendas = Math.max(0, db.estoqueVendas - subVendas);

    salvarBanco();

    await interaction.reply({ content: `✅ Sucesso! **${formatarNumero(quant)} kg** retirados do baú.`, ephemeral: true });

    // Atualiza o painel operacional no canal atual
    try {
      interaction.channel.messages.fetch({ limit: 10 }).then(messages => {
        const botMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].description.includes('HUNTERS'));
        if (botMsg) {
          botMsg.delete();
          enviarPainelCentral(interaction.channel);
        }
      });
    } catch(e) {}
  }

  // MODAL: REGISTRAR VENDA
  if (interaction.customId === 'modal_venda') {
    const armaKey = interaction.fields.getTextInputValue('venda_arma').toLowerCase().trim();
    const qtdStr = interaction.fields.getTextInputValue('venda_quantidade');
    const membroStr = interaction.fields.getTextInputValue('venda_membro') || interaction.user.username;

    const quant = parseInt(qtdStr);

    if (!ARMAS[armaKey]) {
      return interaction.reply({ content: `❌ Código de arma inválido! Use um destes: \`${Object.keys(ARMAS).join(', ')}\``, ephemeral: true });
    }

    if (isNaN(quant) || quant <= 0) {
      return interaction.reply({ content: '❌ Por favor, digite uma quantidade válida.', ephemeral: true });
    }

    const arma = ARMAS[armaKey];
    const valorVenda = arma.preco * quant;
    const acoConsumido = arma.aco * quant;

    if (db.estoqueVendas < acoConsumido) {
      return interaction.reply({ content: `❌ Estoque reservado para vendas insuficiente! Necessita de **${formatarNumero(acoConsumido)} kg** de aço (Atual: ${formatarNumero(db.estoqueVendas)} kg).`, ephemeral: true });
    }

    const split = db.config.splitPercent;
    const comissaoMembro = valorVenda * (split / 100);
    const lucroClan = valorVenda - comissaoMembro;

    db.estoqueVendas -= acoConsumido;
    db.estoque -= acoConsumido;
    db.caixa += lucroClan;

    db.vendas.push({
      userId: interaction.user.id,
      userName: membroStr.replace(/[<@!>]/g, ''),
      arma: arma.nome,
      quantidade: quant,
      total: valorVenda,
      comissao: comissaoMembro,
      aco: acoConsumido,
      data: new Date().toLocaleDateString('pt-BR')
    });

    salvarBanco();

    await interaction.reply({ content: `✅ Venda de **${quant}x ${arma.nome}** registrada com sucesso para **${membroStr}**!`, ephemeral: true });

    // Notificar no chat público da guilda
    const embedVenda = new EmbedBuilder()
      .setTitle('🛒 VENDA REGISTRADA — ERP HUNTERS')
      .setDescription(`Armas fabricadas e vendidas com sucesso para a facção!`)
      .addFields(
        { name: '👤 Vendedor', value: `${membroStr}`, inline: true },
        { name: '🔫 Armas Vendidas', value: `${arma.icon} ${quant}x ${arma.nome}`, inline: true },
        { name: '💰 Total Venda', value: `**${formatarMoeda(valorVenda)}**`, inline: true },
        { name: '🏦 Lucro Clã', value: `\`${formatarMoeda(lucroClan)}\` (${100 - split}%)`, inline: true },
        { name: '💸 Comissão', value: `\`${formatarMoeda(comissaoMembro)}\` (${split}%)`, inline: true },
        { name: '⛓️ Aço Consumido', value: `\`${formatarNumero(acoConsumido)} kg\` do estoque de Vendas`, inline: true }
      )
      .setColor('#10b981')
      .setTimestamp();

    interaction.channel.send({ embeds: [embedVenda] });

    // Atualiza o painel operacional no canal atual
    try {
      interaction.channel.messages.fetch({ limit: 10 }).then(messages => {
        const botMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].description.includes('HUNTERS'));
        if (botMsg) {
          botMsg.delete();
          enviarPainelCentral(interaction.channel);
        }
      });
    } catch(e) {}
  }

  // MODAL: REGISTRAR META
  if (interaction.customId === 'modal_registrar_meta') {
    const membroInput = interaction.fields.getTextInputValue('meta_user').trim();
    const custo = db.config.kitMeta.custo; // 3260

    if (db.estoqueKits < custo) {
      return interaction.reply({ content: `❌ Erro: Estoque de kits insuficiente! Necessário **${formatarNumero(custo)} kg** de aço (Atual: ${formatarNumero(db.estoqueKits)} kg).`, ephemeral: true });
    }

    db.estoqueKits -= custo;
    db.estoque -= custo;
    db.kitsEntregues.push({
      userId: Date.now().toString(), // simulação de ID único
      userName: membroInput.replace(/[<@!>]/g, ''),
      data: new Date().toLocaleDateString('pt-BR')
    });

    salvarBanco();

    await interaction.reply({ content: `✅ Kit da Meta semanal enviado com sucesso para **${membroInput}**!`, ephemeral: true });

    const embedKit = new EmbedBuilder()
      .setTitle('🎁 KIT META SEMANAL ENTREGUE!')
      .setDescription(`O administrador autorizou o envio do Kit semanal para **${membroInput}**!`)
      .addFields(
        { name: '🎁 Itens Inclusos', value: '🔫 AK-47 x1\n🔫 Glock 17 x1\n📦 Box 5.56 x3\n📦 Box Pistola x2' },
        { name: '📉 Custo do Kit', value: `\`${formatarNumero(custo)} kg\` consumidos do Estoque de Kits.` }
      )
      .setColor('#10b981')
      .setTimestamp();

    interaction.channel.send({ embeds: [embedKit] });

    // Atualiza o painel operacional no canal atual
    try {
      interaction.channel.messages.fetch({ limit: 10 }).then(messages => {
        const botMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].description.includes('HUNTERS'));
        if (botMsg) {
          botMsg.delete();
          enviarPainelCentral(interaction.channel);
        }
      });
    } catch(e) {}
  }
});

// Login do Bot com Tratamento de Erros
if (TOKEN) {
  client.login(TOKEN).catch(err => {
    console.error('❌ Falha ao logar o Bot do Discord. Verifique o TOKEN em seu .env:', err.message);
  });
} else {
  console.log('⚠️ [HUNTERS] Token do Discord ausente. Configure a variável DISCORD_TOKEN para iniciar o bot real.');
}
