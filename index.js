/**
 * =========================================================================
 * ⚔️ CLÃ HUNTERS — BOT DE GERENCIAMENTO ERP STANDALONE (Discord.js v14) ⚔️
 * =========================================================================
 *
 * Versão Ultra Moderna, Totalmente Automatizada e Sincronizada em Tempo Real.
 * Adaptada para o Sistema de KIT DA META (8.000 Aços de Meta, 3.260 Aços por Kit).
 *
 * ⚙️ CONFIGURAÇÕES DE HOSPEDAGEM:
 * 1. Requer Node.js v16.9.0 ou superior.
 * 2. Instalação de dependências: npm install discord.js dotenv
 * 3. Configure o arquivo .env:
 *    - DISCORD_TOKEN=Seu_Token_Do_Bot (ou configure no painel da sua hospedagem)
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
  farmes: [],             // Histórico de farmes diários
  painelCanalId: null,    // ID do Canal do Painel Operacional Central salvo
  painelMensagemId: null, // ID da Mensagem do Painel Operacional Central salvo
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

// Referência global em memória para manter o último painel operacional sempre sincronizado e ativo
let ultimoPainelMensagem = null;

// =========================================================================
// 📦 FUNÇÕES DE BANCO DE DADOS
// =========================================================================

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
      if (db.farmes === undefined) db.farmes = [];
      if (db.painelCanalId === undefined) db.painelCanalId = null;
      if (db.painelMensagemId === undefined) db.painelMensagemId = null;
      
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
      
      db.config.kitCost = db.config.kitMeta.custo;

      if (db.estoqueKits === undefined || db.estoqueVendas === undefined) {
        db.estoqueKits = Math.floor(db.estoque * (db.config.percentSteelForKits / 100));
        db.estoqueVendas = db.estoque - db.estoqueKits;
        salvarBanco(true);
      }
    } else {
      salvarBanco(true);
      console.log('📦 [HUNTERS] Novo arquivo de banco de dados criado!');
    }
  } catch (erro) {
    console.error('❌ Erro ao carregar banco de dados:', erro);
  }
}

function salvarBanco(skipPanelUpdate = false) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    if (!skipPanelUpdate) {
      atualizarPainel();
    }
    atualizarStatusPresenca();
  } catch (erro) {
    console.error('❌ Erro ao salvar banco de dados:', erro);
  }
}

// =========================================================================
// ⚙️ HELPERS REUTILIZÁVEIS DE LAYOUT E FORMATAÇÃO
// =========================================================================

const formatarMoeda = (valor) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
};

const formatarNumero = (num) => {
  return new Intl.NumberFormat('pt-BR').format(num);
};

const formatarMoedaResumida = (valor) => {
  return "R$ " + formatarNumero(Math.floor(valor));
};

const getVisualLength = (str) => {
  let length = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xD800 && code <= 0xDBFF) {
      length += 2;
      i++;
    } else if (code === 0xFE0F) {
      // variation selector, 0 width
    } else if (code === 0x26D3 || code === 0x23F1) {
      length += 2;
    } else {
      length += 1;
    }
  }
  return length;
};

const formatarLinhaBox = (label, valor) => {
  const insideWidth = 44;
  const labelLen = getVisualLength(label);
  const valorLen = getVisualLength(valor);
  const spacesCount = insideWidth - labelLen - valorLen;
  const spaces = ' '.repeat(Math.max(1, spacesCount));
  return `║ ${label}${spaces}${valor} ║`;
};

const formatarLinhaCentrada = (texto) => {
  const insideWidth = 44;
  const len = getVisualLength(texto);
  const totalSpaces = insideWidth - len;
  const leftSpaces = Math.max(0, Math.floor(totalSpaces / 2));
  const rightSpaces = Math.max(0, totalSpaces - leftSpaces);
  return `║ ${' '.repeat(leftSpaces)}${texto}${' '.repeat(rightSpaces)} ║`;
};

const formatarLinhaTitulo = (titulo) => {
  const insideWidth = 44;
  const labelLen = getVisualLength(titulo);
  const spacesCount = insideWidth - labelLen;
  const spaces = ' '.repeat(Math.max(0, spacesCount));
  return `║ ${titulo}${spaces} ║`;
};

const temPermissaoEstoque = (member) => {
  if (!member) return false;
  return member.roles.cache.has(CARGO_ESTOQUE_ID) || member.permissions.has('Administrator');
};

function calcularKitsDisponiveis() {
  const custo = (db.config && db.config.kitMeta && db.config.kitMeta.custo) ? db.config.kitMeta.custo : 3260;
  const estoqueKits = db.estoqueKits !== undefined ? db.estoqueKits : Math.floor(db.estoque * 0.3);
  return Math.floor(estoqueKits / custo);
}

const obterMetasEmbed = () => {
  const statsMap = {};
  
  db.vendas.forEach(v => {
    const key = v.userName || 'Membro Antigo';
    if (!statsMap[key]) {
      statsMap[key] = { aco: 0, count: 0 };
    }
    statsMap[key].aco += (v.acoConsumido || 0);
    statsMap[key].count++;
  });

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

function obterAcoTotalUsuario(userId) {
  let total = 0;
  if (db.vendas) {
    db.vendas.forEach(v => {
      if (v.userId === userId) {
        total += (v.acoConsumido || 0);
      }
    });
  }
  if (db.farmes) {
    db.farmes.forEach(f => {
      if (f.userId === userId) {
        total += (f.quantidade || 0);
      }
    });
  }
  return total;
}

async function checarMetaAtingida(userId, acoAntes, acoDepois, canal) {
  if (acoAntes < 8000 && acoDepois >= 8000) {
    const CARGO_NOTIFICAR_ID = '1515125826780135485';
    
    const embedComemoracao = new EmbedBuilder()
      .setTitle('🎉 META DE AÇO BATIDA! 🎉')
      .setColor('#a855f7')
      .setDescription(`🏆 **Excelente trabalho!**\n\n👤 **Membro:** <@${userId}>\n⛓️ **Total Acumulado:** **${formatarNumero(acoDepois)} kg** / 8.000 kg\n\nO membro completou com sucesso a meta de aço para a facção! 🐺`)
      .setFooter({ text: 'Hunters ERP • Meta Semanal de Aço' })
      .setTimestamp();

    if (canal) {
      await canal.send({
        content: `🚨 **ATENÇÃO** <@&${CARGO_NOTIFICAR_ID}>! 🚨\n🏆 O membro <@${userId}> acabou de bater a meta de **8.000 kg** de aço! 🎉`,
        embeds: [embedComemoracao]
      }).catch(err => {
        console.error('Erro ao enviar anúncio de meta batida:', err);
      });
    }
  }
}

// =========================================================================
// 🖥️ GERAÇÃO DO PAYLOAD DO PAINEL
// =========================================================================

const obterPainelPayload = () => {
  const acoKits = db.estoqueKits !== undefined ? db.estoqueKits : Math.floor(db.estoque * ((db.config.percentSteelForKits || 30) / 100));
  const acoVendas = db.estoqueVendas !== undefined ? db.estoqueVendas : (db.estoque - acoKits);
  const kitsProntos = calcularKitsDisponiveis();
  const totalVendido = db.vendas.reduce((acc, v) => acc + v.total, 0);
  const split = db.config.splitPercent;
  const metaIndividual = db.config.kitMeta?.meta ?? 8000;

  const statsMap = {};
  db.vendas.forEach(v => {
    const key = v.userId;
    if (!statsMap[key]) {
      statsMap[key] = { aco: 0 };
    }
    statsMap[key].aco += (v.acoConsumido || v.aco || 0);
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
  const vendasRegistradasCount = db.vendas ? db.vendas.length : 0;

  let painelTexto = "```\n";
  painelTexto += "╔══════════════════════════════════════════════╗\n";
  painelTexto += formatarLinhaCentrada("🐺 HUNTERS ERP • CENTRAL v4.0") + "\n";
  painelTexto += "╠══════════════════════════════════════════════╣\n";
  painelTexto += formatarLinhaTitulo("📦 ESTOQUE DE RECURSOS") + "\n";
  painelTexto += formatarLinhaBox("├─ ⛓️ Aço Total:", `${formatarNumero(db.estoque)} kg`) + "\n";
  painelTexto += formatarLinhaBox("├─ 🔫 Aço Vendas:", `${formatarNumero(acoVendas)} kg (${db.config.percentSteelForSales || 70}%)`) + "\n";
  painelTexto += formatarLinhaBox("├─ 🎁 Aço Kits:", `${formatarNumero(acoKits)} kg (${db.config.percentSteelForKits || 30}%)`) + "\n";
  painelTexto += formatarLinhaBox("└─ 📦 Kits Prontos:", `${formatarNumero(kitsProntos)} Kits`) + "\n";
  painelTexto += "╠══════════════════════════════════════════════╣\n";
  painelTexto += formatarLinhaTitulo("💰 CONTROLE FINANCEIRO") + "\n";
  painelTexto += formatarLinhaBox("├─ 🏦 Caixa do Clã:", formatarMoedaResumida(db.caixa)) + "\n";
  painelTexto += formatarLinhaBox("├─ 💵 Total Vendido:", formatarMoedaResumida(totalVendido)) + "\n";
  painelTexto += formatarLinhaBox("└─ 📈 Divisão:", `🏦 ${100 - split}% Clã | 💸 ${split}% Membro`) + "\n";
  painelTexto += "╠══════════════════════════════════════════════╣\n";
  painelTexto += formatarLinhaTitulo("🎯 METAS & ESTATÍSTICAS") + "\n";
  painelTexto += formatarLinhaBox("├─ 🏆 Objetivo:", `${formatarNumero(metaIndividual)} kg por Membro`) + "\n";
  painelTexto += formatarLinhaBox("├─ 👥 Metas Batidas:", `${metasBatidas} Membros`) + "\n";
  painelTexto += formatarLinhaBox("└─ 🛒 Vendas Registradas:", `${vendasRegistradasCount} Vendas`) + "\n";
  painelTexto += "╠══════════════════════════════════════════════╣\n";
  painelTexto += formatarLinhaCentrada("🟢 Online | 💾 Sincronizado | ⏱️ Real-Time") + "\n";
  painelTexto += "╚══════════════════════════════════════════════╝\n";
  painelTexto += "```";

  const embedPainel = new EmbedBuilder()
    .setDescription(painelTexto)
    .setColor('#a855f7')
    .setTimestamp();

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

  return { embeds: [embedPainel], components: [row1, row2] };
};

// =========================================================================
// 🔄 FUNÇÕES DE SINCRONIZAÇÃO AUTOMÁTICA EM TEMPO REAL
// =========================================================================

async function atualizarPainel() {
  try {
    if (!db.painelCanalId || !db.painelMensagemId) return;

    const canal = client.channels.cache.get(db.painelCanalId) || await client.channels.fetch(db.painelCanalId).catch(() => null);
    if (!canal) {
      console.log(`⚠️ [HUNTERS] Canal do painel não encontrado: ${db.painelCanalId}`);
      return;
    }

    const messageObj = await canal.messages.fetch(db.painelMensagemId).catch(async (err) => {
      if (err.code === 10008) {
        console.log(`⚠️ [HUNTERS] Mensagem do painel foi apagada. Recriando automaticamente...`);
        db.painelMensagemId = null;
        salvarBanco(true);
        await criarPainel(canal);
      }
      return null;
    });

    if (!messageObj) return;

    const payload = obterPainelPayload();
    await messageObj.edit(payload).then(msg => {
      ultimoPainelMensagem = msg;
    }).catch(async (err) => {
      if (err.code === 10008) {
        console.log(`⚠️ [HUNTERS] Mensagem do painel foi apagada ao editar. Recriando...`);
        db.painelMensagemId = null;
        salvarBanco(true);
        await criarPainel(canal);
      } else {
        console.error('❌ [HUNTERS] Erro ao editar painel central:', err.message);
      }
    });

    atualizarStatusPresenca();
  } catch (e) {
    console.error('❌ [HUNTERS] Erro geral ao atualizar painel central:', e.message);
  }
}

async function criarPainel(canal) {
  if (!canal) return;

  if (db.painelCanalId && db.painelMensagemId) {
    try {
      const canalSalvo = client.channels.cache.get(db.painelCanalId) || await client.channels.fetch(db.painelCanalId).catch(() => null);
      if (canalSalvo) {
        const msg = await canalSalvo.messages.fetch(db.painelMensagemId).catch(() => null);
        if (msg) {
          console.log(`📦 [HUNTERS] Painel operacional já existe. Apenas atualizando...`);
          ultimoPainelMensagem = msg;
          await atualizarPainel();
          return;
        }
      }
    } catch (e) {
      console.log(`[HUNTERS] Erro ao buscar mensagem em criarPainel:`, e.message);
    }
  }

  console.log(`📦 [HUNTERS] Criando novo painel central no canal #${canal.name}...`);
  const payload = obterPainelPayload();
  try {
    const msg = await canal.send(payload);
    db.painelCanalId = canal.id;
    db.painelMensagemId = msg.id;
    ultimoPainelMensagem = msg;
    salvarBanco(true);
    console.log(`✅ [HUNTERS] Novo painel principal criado e IDs salvos com sucesso!`);
    atualizarStatusPresenca();
  } catch (err) {
    console.error("❌ [HUNTERS] Erro ao enviar painel operacional:", err.message);
  }
}

function atualizarStatusPresenca() {
  try {
    if (!client.user) return;

    let topVendedorStr = 'Nenhum';
    if (db.vendas && db.vendas.length > 0) {
      const rankingUser = {};
      db.vendas.forEach(v => {
        if (!rankingUser[v.userName]) rankingUser[v.userName] = 0;
        rankingUser[v.userName] += v.total;
      });
      const topVendedor = Object.entries(rankingUser).sort((a, b) => b[1] - a[1])[0];
      if (topVendedor) {
        topVendedorStr = `${topVendedor[0]}`;
      }
    }

    const kitsProntos = calcularKitsDisponiveis();
    const statusText = `⛓️ ${formatarNumero(db.estoque)}kg | 🏦 R$ ${formatarNumero(Math.floor(db.caixa))} | 🎁 ${kitsProntos} Kits | 🏆 Top: ${topVendedorStr}`;

    client.user.setPresence({
      activities: [{ 
        name: statusText.slice(0, 127), 
        type: ActivityType.Playing 
      }],
      status: 'dnd'
    });
  } catch (e) {
    console.error('❌ [HUNTERS] Erro ao atualizar status de presença:', e.message);
  }
}

const enviarPainelCentral = async (channel, targetUser = null) => {
  if (db.painelCanalId === channel.id && db.painelMensagemId) {
    try {
      const msg = await channel.messages.fetch(db.painelMensagemId).catch(() => null);
      if (msg) {
        ultimoPainelMensagem = msg;
        await atualizarPainel();
        if (targetUser) {
          await channel.send({ content: `Olá ${targetUser}, o painel central já está ativo neste canal!`, ephemeral: true }).catch(() => null);
        }
        return;
      }
    } catch (e) {}
  }

  if (db.painelCanalId && db.painelMensagemId) {
    try {
      const canalAntigo = client.channels.cache.get(db.painelCanalId) || await client.channels.fetch(db.painelCanalId).catch(() => null);
      if (canalAntigo) {
        const msgAntiga = await canalAntigo.messages.fetch(db.painelMensagemId).catch(() => null);
        if (msgAntiga) {
          await msgAntiga.delete().catch(() => null);
          console.log(`[HUNTERS] Painel antigo no canal ${db.painelCanalId} foi apagado.`);
        }
      }
    } catch (e) {
      console.log(`[HUNTERS] Não foi possível deletar o painel antigo:`, e.message);
    }
    db.painelMensagemId = null;
    salvarBanco(true);
  }

  await criarPainel(channel);
  if (targetUser) {
    await channel.send({ content: `Olá ${targetUser}, aqui está o painel central:`, ephemeral: true }).catch(() => null);
  }
};

setInterval(async () => {
  await atualizarPainel();
}, 10000);

// =========================================================================
// 🟢 EVENTO READY (INICIALIZAÇÃO E AUTO-LOCALIZAÇÃO)
// =========================================================================

client.once('ready', async () => {
  console.log(`🤖 [HUNTERS] Bot online como ${client.user.tag}!`);
  carregarBanco();
  
  if (db.painelCanalId && db.painelMensagemId) {
    try {
      const canal = client.channels.cache.get(db.painelCanalId) || await client.channels.fetch(db.painelCanalId).catch(() => null);
      if (canal) {
        const msg = await canal.messages.fetch(db.painelMensagemId).catch(() => null);
        if (msg) {
          ultimoPainelMensagem = msg;
          console.log(`📦 [HUNTERS] Painel central localizado na inicialização com sucesso!`);
          await atualizarPainel();
        } else {
          console.log(`⚠️ [HUNTERS] Mensagem do painel salva não pôde ser localizada no canal.`);
          db.painelMensagemId = null;
          salvarBanco(true);
        }
      } else {
        console.log(`⚠️ [HUNTERS] Canal do painel salvo não pôde ser localizado.`);
        db.painelCanalId = null;
        db.painelMensagemId = null;
        salvarBanco(true);
      }
    } catch (e) {
      console.error(`❌ Erro ao localizar painel no ready:`, e.message);
    }
  }

  if (!ultimoPainelMensagem) {
    console.log(`🔍 [HUNTERS] Buscando canais elegíveis para o painel de forma autônoma...`);
    let canalCandidato = null;
    for (const guild of client.guilds.cache.values()) {
      const channels = await guild.channels.fetch().catch(() => null);
      if (!channels) continue;
      
      canalCandidato = channels.find(c => c.isTextBased() && (
        c.name === 'painel' || 
        c.name === 'painel-hunters' || 
        c.name === 'hunters-painel' || 
        c.name === 'erp' || 
        c.name === 'gerenciamento'
      ));
      if (canalCandidato) break;
    }
    
    if (canalCandidato) {
      console.log(`🎯 [HUNTERS] Canal automático encontrado para painel: #${canalCandidato.name}`);
      await criarPainel(canalCandidato);
    } else {
      console.log(`⚠️ [HUNTERS] Nenhum canal de painel padrão encontrado. Use !painel para criá-lo.`);
    }
  }

  atualizarStatusPresenca();
  setInterval(atualizarStatusPresenca, 10000);
});

// =========================================================================
// 💬 EVENTO DE MENSAGEM (COMANDOS DE PREFIXO)
// =========================================================================

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // COMANDO: AJUDA / PAINEL
  if (command === 'ajuda' || command === 'help' || command === 'painel') {
    return enviarPainelCentral(message.channel, message.author);
  }

  // COMANDO: AVISO META (COMANDO DE DISPARO DO AVISO PEDIDO)
  if (command === 'avisometa' || command === 'geraraviso' || command === 'aviso') {
    // Apenas Admins ou membros com o cargo de controle do estoque podem disparar
    if (!message.member.permissions.has('Administrator') && !temPermissaoEstoque(message.member)) {
      return message.reply('❌ **Acesso Negado!** Apenas administradores do clã ou membros autorizados com acesso ao estoque podem disparar este aviso.');
    }

    const canalAvisosId = '1515125864033943712';
    const cargoNotificarId = '1515125826780135485';

    let canalAvisos = client.channels.cache.get(canalAvisosId);
    if (!canalAvisos) {
      try {
        canalAvisos = await client.channels.fetch(canalAvisosId);
      } catch (e) {
        return message.reply(`❌ **Erro:** Não consegui localizar o canal de avisos com o ID \`${canalAvisosId}\`. Verifique se o bot possui acesso e permissões de leitura/escrita nele.`);
      }
    }

    const embedAviso = new EmbedBuilder()
      .setTitle('📢 AVISO DE META OBRIGATÓRIA — HUNTERS ERP')
      .setColor('#da373c')
      .setDescription(`⚠️ **ATENÇÃO MEMBROS! DIRETRIZ CRÍTICA DA FACÇÃO HUNTERS** ⚠️\n\n` +
        `⛓️ **META INDIVIDUAL OBRIGATÓRIA:**\n` +
        `É **totalmente obrigatório** farmar e registrar no mínimo **8.000 kg de aço** para ter o direito de receber o seu **Kit de Meta**.\n\n` +
        `⏱️ **PRAZO DE TOLERÂNCIA DE 3 DIAS:**\n` +
        `Atenção: quem **NÃO ENTRAR** ou não preencher seus farmes no painel dentro do período de **3 dias** para a entrega da meta será **SUMARIAMENTE RETIRADO DO PAINEL**!\n\n` +
        `🎯 **COMO PREENCHER A META:**\n` +
        `Você deve registrar seus farmes clicando no botão **Registrar Meta** do nosso painel no canal oficial:\n` +
        `👉 **Clique aqui para ir ao Canal do Painel:** <#1523844178151473193>\n` +
        `*(Membros que não preencherem estarão sujeitos à remoção das permissões de kits e gerenciamento)*\n\n` +
        `Não perca o prazo e garanta o seu kit semanal regulamentar de armamentos! Foco total na meta! ⚔️`)
      .setFooter({ text: 'Hunters ERP • Administração Hunters' })
      .setTimestamp();

    try {
      await canalAvisos.send({
        content: `🚨 **ATENÇÃO** <@&${cargoNotificarId}>! 🚨\n**AVISO IMPORTANTÍSSIMO SOBRE A META DE AÇO DOS KITS!**`,
        embeds: [embedAviso]
      });
      return message.reply(`✅ **Aviso enviado com sucesso!** A mensagem com as diretrizes e marcação foi enviada no canal de avisos <#${canalAvisosId}>.`);
    } catch (err) {
      console.error('Erro ao enviar mensagem de aviso de meta:', err);
      return message.reply(`❌ **Erro ao enviar aviso:** \`${err.message}\`. Certifique-se de que o bot possui permissão de enviar mensagens e embeds no canal <#${canalAvisosId}>.`);
    }
  }

  // COMANDO: KIT (SISTEMA DE CALCULO)
  if (command === 'kit') {
    const acao = args[0]?.toLowerCase();

    if (!acao) {
      return message.reply(`⚠️ **Uso do Comando Kit:**\n\`${PREFIX}kit calcular\` - Calcula capacidade de kits\n\`${PREFIX}kit estoque\` - Detalha o estoque de kits`);
    }

    if (acao === 'calcular') {
      const kits = calcularKitsDisponiveis();
      const custoReal = db.config.kitMeta?.custo ?? 3260;
      const acoKits = db.estoqueKits !== undefined ? db.estoqueKits : Math.floor(db.estoque * 0.3);

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🎁 KIT DA META HUNTERS — CÁLCULO')
            .setColor('#a855f7')
            .addFields(
              { name: '🛠️ Custo por Kit', value: `**${formatarNumero(custoReal)} Aços**`, inline: true },
              { name: '📦 Kits disponíveis', value: `**${kits} kits**`, inline: true },
              { name: '⛓️ Aço reservado (Baú)', value: `**${formatarNumero(acoKits)} kg**`, inline: true }
            )
            .setFooter({ text: 'Hunters ERP • Kit da Meta' })
            .setTimestamp()
        ]
      });
    }

    if (acao === 'estoque') {
      const kits = calcularKitsDisponiveis();
      const acoKits = db.estoqueKits !== undefined ? db.estoqueKits : Math.floor(db.estoque * 0.3);

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('📦 ESTOQUE KIT META')
            .setColor('#9333ea')
            .addFields(
              { name: '⛓️ Aço Kits', value: `**${formatarNumero(acoKits)} kg**`, inline: true },
              { name: '🎁 Kits prontos', value: `**${kits} un**`, inline: true }
            )
            .setFooter({ text: 'Hunters ERP • Estoque de Kits' })
            .setTimestamp()
        ]
      });
    }
  }

  // COMANDO: ESTOQUE
  if (command === 'estoque') {
    const pctKits = db.config.percentSteelForKits || 30;
    const pctSales = db.config.percentSteelForSales || 70;
    const acoKits = db.estoqueKits !== undefined ? db.estoqueKits : Math.floor(db.estoque * (pctKits / 100));
    const acoVendas = db.estoqueVendas !== undefined ? db.estoqueVendas : (db.estoque - acoKits);
    const kitsProntos = calcularKitsDisponiveis();

    const embedEstoque = new EmbedBuilder()
      .setTitle('📦 ESTOQUE GERAL — HUNTERS')
      .setColor('#9333ea')
      .addFields(
        { name: '⛓️ Total no Baú', value: `**${formatarNumero(db.estoque)} kg**`, inline: false },
        { name: '🔫 Reservado p/ Vendas', value: `**${formatarNumero(acoVendas)} kg** (${pctSales}%)`, inline: true },
        { name: '⚙️ Reservado p/ Kits', value: `**${formatarNumero(acoKits)} kg** (${pctKits}%)`, inline: true },
        { name: '📦 Kits Prontos Disponíveis', value: `**${formatarNumero(kitsProntos)} un** (Custo: ${formatarNumero(db.config.kitMeta?.custo ?? 3260)}kg/kit da meta)`, inline: false }
      );

    let producaoStr = '';
    Object.keys(ARMAS).forEach(key => {
      const arma = ARMAS[key];
      const maxFabricavel = Math.floor(acoVendas / arma.aco);
      producaoStr += `${arma.icon} **${arma.nome}**: ${formatarNumero(maxFabricavel)} un *(Custo: ${formatarNumero(arma.aco)}kg de aço de vendas)*\n`;
    });
    embedEstoque.addFields({ name: '🛠️ Capacidade de Venda de Armas', value: producaoStr });

    return message.reply({ embeds: [embedEstoque] });
  }

  // COMANDO: CAIXA
  if (command === 'caixa' || command === 'cofre') {
    const totalVendido = db.vendas.reduce((acc, v) => acc + v.total, 0);
    const embedCaixa = new EmbedBuilder()
      .setTitle('💰 CAIXA COFRE HUNTERS')
      .setColor('#10b981')
      .addFields(
        { name: '💵 Saldo em Caixa', value: `**${formatarMoeda(db.caixa)}**` },
        { name: '📈 Total Faturado', value: `**${formatarMoeda(totalVendido)}**`, inline: true },
        { name: '📜 Vendas Registradas', value: `**${db.vendas.length} transações**`, inline: true }
      )
      .setTimestamp();
    return message.reply({ embeds: [embedCaixa] });
  }

  // COMANDO: VENDER
  if (command === 'vender' || command === 'venda') {
    const membro = message.mentions.members.first() || (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);
    const armaChave = args[1]?.toLowerCase();
    const quantidade = parseInt(args[2]);
    const desconto = parseInt(args[3]) || 0;

    if (!membro || !armaChave || isNaN(quantidade) || quantidade <= 0) {
      return message.reply(`❌ **Formato incorreto!** Use:\n\`${PREFIX}vender <@membro|ID> <ak47|awp|m16|sawedoff|glock17> <quantidade> [desconto_porcentagem]\``);
    }

    const arma = ARMAS[armaChave];
    if (!arma) {
      return message.reply(`❌ **Arma inválida!** Opções: \`ak47\`, \`awp\`, \`m16\`, \`sawedoff\`, \`glock17\``);
    }

    const acoNecessario = arma.aco * quantidade;
    const acoVendas = db.estoqueVendas !== undefined ? db.estoqueVendas : Math.floor(db.estoque * ((db.config.percentSteelForSales || 70) / 100));

    if (acoVendas < acoNecessario) {
      return message.reply(`❌ **Aço para Vendas Insuficiente!** É necessário **${formatarNumero(acoNecessario)} kg** de aço para fabricação. O baú possui **${formatarNumero(acoVendas)} kg** reservado para vendas (Aço total no baú: **${formatarNumero(db.estoque)} kg**).`);
    }

    const precoBase = arma.preco * quantidade;
    const valorDesconto = precoBase * (desconto / 100);
    const totalVenda = precoBase - valorDesconto;
    const comissaoVendedor = totalVenda * (db.config.splitPercent / 100);
    const lucroClas = totalVenda - comissaoVendedor;

    db.estoqueVendas = acoVendas - acoNecessario;
    db.estoqueKits = db.estoqueKits !== undefined ? db.estoqueKits : Math.floor(db.estoque * ((db.config.percentSteelForKits || 30) / 100));
    db.estoque = db.estoqueKits + db.estoqueVendas;
    db.caixa += lucroClas;

    const novaVenda = {
      id: `V-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
      userId: membro.id,
      userName: membro.user.username,
      arma: arma.nome,
      quantidade,
      total: totalVenda,
      desconto,
      comissao: comissaoVendedor,
      acoConsumido: acoNecessario
    };

    const acoAntes = obterAcoTotalUsuario(membro.id);

    db.vendas.push(novaVenda);
    salvarBanco();

    const acoDepois = obterAcoTotalUsuario(membro.id);
    checarMetaAtingida(membro.id, acoAntes, acoDepois, message.channel);

    const embedSucesso = new EmbedBuilder()
      .setTitle('🎯 VENDA REGISTRADA COM SUCESSO')
      .setColor('#10b981')
      .addFields(
        { name: '👤 Vendedor', value: `${membro}`, inline: true },
        { name: '🔫 Armamento', value: `**${quantidade}x ${arma.nome}**`, inline: true },
        { name: '📉 Desconto', value: `**${desconto}%**`, inline: true },
        { name: '💰 Total Pago', value: `**${formatarMoeda(totalVenda)}**` },
        { name: '💸 Split Vendedor (Comissão)', value: `**${formatarMoeda(comissaoVendedor)}** (${db.config.splitPercent}%)`, inline: true },
        { name: '👑 Cofre HUNTERS', value: `**+${formatarMoeda(lucroClas)}** (${100 - db.config.splitPercent}%)`, inline: true },
        { name: '⛓️ Aço de Vendas Consumido', value: `**-${formatarNumero(acoNecessario)} kg**`, inline: true }
      )
      .setFooter({ text: `ID da Transação: ${novaVenda.id}` })
      .setTimestamp();

    return message.reply({ embeds: [embedSucesso] });
  }

  // COMANDO: RANKING
  if (command === 'ranking') {
    if (db.vendas.length === 0) {
      return message.reply('🏆 **Ranking Vazio!** Nenhuma venda foi registrada neste ciclo.');
    }

    const rankingUser = {};
    db.vendas.forEach(v => {
      if (!rankingUser[v.userName]) rankingUser[v.userName] = { total: 0, count: 0 };
      rankingUser[v.userName].total += v.total;
      rankingUser[v.userName].count += v.quantidade;
    });

    const rankingOrdenado = Object.keys(rankingUser).map(userName => ({
      userName,
      total: rankingUser[userName].total,
      count: rankingUser[userName].count
    })).sort((a, b) => b.total - a.total);

    let rankingStr = '';
    rankingOrdenado.slice(0, 10).forEach((user, index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`;
      rankingStr += `${medal} **${user.userName}** — Faturamento: \`${formatarMoeda(user.total)}\` *(Qtd: ${user.count} armas)*\n`;
    });

    const embedRanking = new EmbedBuilder()
      .setTitle('🏆 RANKING DE ELITE — HUNTERS')
      .setColor('#f59e0b')
      .setDescription(rankingStr)
      .setTimestamp();

    return message.reply({ embeds: [embedRanking] });
  }

  // COMANDO: METAS
  if (command === 'metas' || command === 'meta') {
    const embedMetas = obterMetasEmbed();
    return message.reply({ embeds: [embedMetas] });
  }

  // COMANDO: HISTORICO / LOGS
  if (command === 'historico' || command === 'logs') {
    if (db.vendas.length === 0) {
      return message.reply('📑 Nenhuma transação registrada até o momento.');
    }

    const ultimasVendas = db.vendas.slice(-10).reverse();
    let listStr = '';
    ultimasVendas.forEach(v => {
      listStr += `• **${v.id}** | **${v.userName}** vendeu **${v.quantidade}x ${v.arma}** por \`${formatarMoeda(v.total)}\` *(Desconto: ${v.desconto}% | Aço: -${formatarNumero(v.acoConsumido)}kg)*\n`;
    });

    const embedLogs = new EmbedBuilder()
      .setTitle('📑 ÚLTIMAS TRANSAÇÕES — ERP HUNTERS')
      .setColor('#6b7280')
      .setDescription(listStr)
      .setTimestamp();

    return message.reply({ embeds: [embedLogs] });
  }

  // COMANDO: FARME / REGISTRAR_META
  if (command === 'farme' || command === 'farm' || command === 'registrar' || command === 'registrar_meta') {
    const quantidade = parseInt(args[0]);
    if (isNaN(quantidade) || quantidade <= 0) {
      return message.reply(`❌ **Uso correto:** \`${PREFIX}farme <quantidade_em_kg>\`\nExemplo: \`${PREFIX}farme 2500\``);
    }

    const pctKits = db.config.percentSteelForKits || 30;
    const pctSales = db.config.percentSteelForSales || 70;
    const addKits = Math.floor(quantidade * (pctKits / 100));
    const addSales = quantidade - addKits;

    db.estoqueKits = (db.estoqueKits || 0) + addKits;
    db.estoqueVendas = (db.estoqueVendas || 0) + addSales;
    db.estoque += quantidade;

    if (!db.farmes) db.farmes = [];
    const novoFarme = {
      id: `F-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
      userId: message.author.id,
      userName: message.author.username,
      quantidade
    };
    const acoAntes = obterAcoTotalUsuario(message.author.id);

    db.farmes.push(novoFarme);
    salvarBanco();

    const acoDepois = obterAcoTotalUsuario(message.author.id);
    checarMetaAtingida(message.author.id, acoAntes, acoDepois, message.channel);

    await message.reply(`🚜 **Farme registrado com sucesso!** Foram adicionados **+${formatarNumero(quantidade)} kg** ao baú.`);

    const canalLogId = '1525698045537161226';
    let canalLog = client.channels.cache.get(canalLogId);
    if (!canalLog) {
      try {
        canalLog = await client.channels.fetch(canalLogId);
      } catch (e) {
        console.log(`Erro ao buscar canal de log ${canalLogId}:`, e.message);
      }
    }

    const embedLog = new EmbedBuilder()
      .setTitle('🚜 REGISTRO DE FARME DIÁRIO')
      .setColor('#10b981')
      .setDescription(`👤 **Membro:** ${message.author} (${message.author.username})\n📦 **Quantidade:** **${formatarNumero(quantidade)} kg** de aço\n📅 **Data:** <t:${Math.floor(Date.now() / 1000)}:f>`)
      .setTimestamp();

    if (canalLog) {
      await canalLog.send({ embeds: [embedLog] }).catch(err => {
        console.error('Erro ao enviar mensagem para o canal de log:', err);
      });
    }

    const embedPublico = new EmbedBuilder()
      .setTitle('🚜 NOVO FARME DIÁRIO REGISTRADO')
      .setColor('#a855f7')
      .setDescription(`👤 O membro ${message.author} registrou **${formatarNumero(quantidade)} kg** de aço no baú!`)
      .setTimestamp();

    return message.channel.send({ embeds: [embedPublico] });
  }

  // COMANDO ADMIN: ADDACO
  if (command === 'addaco') {
    if (!temPermissaoEstoque(message.member)) {
      return message.reply(`❌ **Acesso Negado!** Apenas membros com o cargo <@&${CARGO_ESTOQUE_ID}> ou administradores podem adicionar aço.`);
    }

    const quantidade = parseInt(args[0]);
    if (isNaN(quantidade) || quantidade <= 0) {
      return message.reply(`❌ Use o formato: \`${PREFIX}addaco <kg>\``);
    }

    const pctKits = db.config.percentSteelForKits || 30;
    const pctSales = db.config.percentSteelForSales || 70;
    const addKits = Math.floor(quantidade * (pctKits / 100));
    const addSales = quantidade - addKits;

    db.estoqueKits = (db.estoqueKits || 0) + addKits;
    db.estoqueVendas = (db.estoqueVendas || 0) + addSales;
    db.estoque += quantidade;
    salvarBanco();

    return message.reply(`⛓️ **Estoque Abastecido!** Foram adicionados **+${formatarNumero(quantidade)} kg** ao baú. Distribuído proporcionalmente:\n📥 **+${formatarNumero(addSales)} kg** para Vendas\n📥 **+${formatarNumero(addKits)} kg** para Kits.`);
  }

  // COMANDO ADMIN: SUBACO
  if (command === 'subaco' || command === 'sub') {
    if (!temPermissaoEstoque(message.member)) {
      return message.reply(`❌ **Acesso Negado!** Apenas membros com o cargo <@&${CARGO_ESTOQUE_ID}> ou administradores podem retirar aço.`);
    }

    const quantidade = parseInt(args[0]);
    if (isNaN(quantidade) || quantidade <= 0) {
      return message.reply(`❌ Use o formato: \`${PREFIX}subaco <kg>\``);
    }

    if (db.estoque < quantidade) {
      return message.reply(`❌ **Quantidade insuficiente!** O baú possui apenas **${formatarNumero(db.estoque)} kg**.`);
    }

    const pctKits = db.config.percentSteelForKits || 30;
    const pctSales = db.config.percentSteelForSales || 70;
    const subKits = Math.floor(quantidade * (pctKits / 100));
    const subSales = quantidade - subKits;

    db.estoqueKits = Math.max(0, (db.estoqueKits || 0) - subKits);
    db.estoqueVendas = Math.max(0, (db.estoqueVendas || 0) - subSales);
    db.estoque = db.estoqueKits + db.estoqueVendas;
    salvarBanco();

    return message.reply(`⛓️ **Retirada Efetuada!** Removidos **-${formatarNumero(quantidade)} kg** proporcionalmente do baú (Vendas: -${formatarNumero(subSales)}kg, Kits: -${formatarNumero(subKits)}kg).`);
  }

  // COMANDO ADMIN: LIMPAR / RESET
  if (command === 'limpar' || command === 'reset' || command === 'resetar') {
    if (!message.member.permissions.has('Administrator')) {
      return message.reply('❌ Apenas administradores do servidor podem resetar os logs de vendas.');
    }

    db.vendas = [];
    db.farmes = [];
    db.estoque = 69000;
    db.estoqueKits = 20700;
    db.estoqueVendas = 48300;
    db.caixa = 280000;
    salvarBanco();

    return message.reply('🧹 **Ciclo Resetado!** Todos os logs de vendas e farmes foram apagados e os valores retornaram ao padrão de fábrica.');
  }
});

// =========================================================================
// 🖱️ MANIPULADOR DE INTERAÇÕES (BOTÕES E REQUISIÇÕES)
// =========================================================================

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    const customId = interaction.customId;

    if (customId === 'painel_estoque') {
      const pctKits = db.config.percentSteelForKits || 30;
      const pctSales = db.config.percentSteelForSales || 70;
      const acoKits = db.estoqueKits !== undefined ? db.estoqueKits : Math.floor(db.estoque * (pctKits / 100));
      const acoVendas = db.estoqueVendas !== undefined ? db.estoqueVendas : (db.estoque - acoKits);
      const kitsProntos = calcularKitsDisponiveis();

      const embedEstoque = new EmbedBuilder()
        .setTitle('⛓️ CONSULTA RÁPIDA: ESTOQUE')
        .setColor('#9333ea')
        .addFields(
          { name: 'Aço Total no Baú', value: `\`${formatarNumero(db.estoque)} kg\``, inline: false },
          { name: 'Aço p/ Vendas', value: `\`${formatarNumero(acoVendas)} kg\` (${pctSales}%)`, inline: true },
          { name: 'Aço p/ Kits', value: `\`${formatarNumero(acoKits)} kg\` (${pctKits}%)`, inline: true },
          { name: 'Kits Prontos Disponíveis', value: `\`${formatarNumero(kitsProntos)} un\``, inline: false }
        );

      return interaction.reply({ embeds: [embedEstoque], ephemeral: true });
    }

    if (customId === 'painel_kits') {
      const kits = calcularKitsDisponiveis();
      const custoReal = db.config.kitMeta?.custo ?? 3260;

      return interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setTitle('🎁 KIT DA META HUNTERS')
            .setColor('#a855f7')
            .setDescription(`🏆 **Meta Semanal:** 8.000 Aços\n\n🎁 **Composição do Kit:**\n🔫 **AK-47** x1\n🔫 **Glock 17** x1\n📦 **Box 5.56** x3\n📦 **Box Pistola** x2\n\n🛠️ **Custo Real:** \`${formatarNumero(custoReal)} Aços\`\n\n📦 **Disponíveis:** \`${kits} kits\` prontos para entrega no estoque do baú.`)
        ]
      });
    }

    if (customId === 'painel_caixa') {
      const totalVendido = db.vendas.reduce((acc, v) => acc + v.total, 0);
      const embedCaixa = new EmbedBuilder()
        .setTitle('💰 CONSULTA RÁPIDA: COFRE')
        .setColor('#10b981')
        .addFields(
          { name: 'Saldo em Caixa', value: `**${formatarMoeda(db.caixa)}**` },
          { name: 'Faturamento de Vendas', value: `\`${formatarMoeda(totalVendido)}\`` }
        );

      return interaction.reply({ embeds: [embedCaixa], ephemeral: true });
    }

    if (customId === 'painel_ranking') {
      if (db.vendas.length === 0) {
        return interaction.reply({ content: '🏆 Nenhum dado de vendas registrado para gerar o ranking ainda.', ephemeral: true });
      }

      const rankingUser = {};
      db.vendas.forEach(v => {
        if (!rankingUser[v.userName]) rankingUser[v.userName] = { total: 0 };
        rankingUser[v.userName].total += v.total;
      });

      const rankingOrdenado = Object.keys(rankingUser).map(userName => ({
        userName,
        total: rankingUser[userName].total
      })).sort((a, b) => b.total - a.total);

      let rankingStr = '';
      rankingOrdenado.slice(0, 5).forEach((user, index) => {
        const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`;
        rankingStr += `${medal} **${user.userName}**: ${formatarMoeda(user.total)}\n`;
      });

      const embedRanking = new EmbedBuilder()
        .setTitle('🏆 TOP 5 VENDEDORES')
        .setColor('#f59e0b')
        .setDescription(rankingStr);

      return interaction.reply({ embeds: [embedRanking], ephemeral: true });
    }

    if (customId === 'painel_metas') {
      const embedMetas = obterMetasEmbed();
      return interaction.reply({ embeds: [embedMetas], ephemeral: true });
    }

    if (customId === 'painel_historico') {
      if (db.vendas.length === 0) {
        return interaction.reply({ content: '📑 Nenhuma transação recente encontrada.', ephemeral: true });
      }

      const ultimasVendas = db.vendas.slice(-6).reverse();
      let listStr = '';
      ultimasVendas.forEach(v => {
        listStr += `• **${v.id}** | **${v.userName}** vendeu **${v.quantidade}x ${v.arma}** por \`${formatarMoeda(v.total)}\`\n`;
      });

      const embedLogs = new EmbedBuilder()
        .setTitle('📑 HISTÓRICO RECENTE')
        .setColor('#6b7280')
        .setDescription(listStr);

      return interaction.reply({ embeds: [embedLogs], ephemeral: true });
    }

    if (customId === 'painel_addaco') {
      if (!temPermissaoEstoque(interaction.member)) {
        return interaction.reply({ 
          content: `❌ **Acesso Negado!** Apenas membros com o cargo <@&${CARGO_ESTOQUE_ID}> ou administradores podem adicionar aço ao baú.`, 
          ephemeral: true 
        });
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_addaco')
        .setTitle('➕ ADICIONAR AÇO');

      const inputAco = new TextInputBuilder()
        .setCustomId('aco_quantidade')
        .setLabel('Quantidade de Aço (em kg)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 5000')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(inputAco);
      modal.addComponents(row);

      return interaction.showModal(modal);
    }

    if (customId === 'painel_subaco') {
      if (!temPermissaoEstoque(interaction.member)) {
        return interaction.reply({ 
          content: `❌ **Acesso Negado!** Apenas membros com o cargo <@&${CARGO_ESTOQUE_ID}> ou administradores podem retirar aço do baú.`, 
          ephemeral: true 
        });
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_subaco')
        .setTitle('➖ RETIRAR AÇO');

      const inputAco = new TextInputBuilder()
        .setCustomId('aco_quantidade')
        .setLabel('Quantidade de Aço (em kg)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 5000')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(inputAco);
      modal.addComponents(row);

      return interaction.showModal(modal);
    }

    if (customId === 'painel_registrar_meta') {
      const modal = new ModalBuilder()
        .setCustomId('modal_registrar_meta')
        .setTitle('🎯 REGISTRAR FARME DIÁRIO');

      const inputAco = new TextInputBuilder()
        .setCustomId('farme_quantidade')
        .setLabel('Quantidade de Aço Farmado (em kg)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 2500')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(inputAco);
      modal.addComponents(row);

      return interaction.showModal(modal);
    }

    if (customId === 'painel_venda') {
      const modal = new ModalBuilder()
        .setCustomId('modal_vender')
        .setTitle('💰 REGISTRAR VENDA');

      const inputVendedor = new TextInputBuilder()
        .setCustomId('vendedor_id')
        .setLabel('Vendedor (Mencione ou insira o ID)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: @Membro ou 123456789012345')
        .setRequired(true);

      const inputArma = new TextInputBuilder()
        .setCustomId('arma_chave')
        .setLabel('Arma (ak47, awp, m16, sawedoff, glock17)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: ak47')
        .setRequired(true);

      const inputQtd = new TextInputBuilder()
        .setCustomId('quantidade')
        .setLabel('Quantidade')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 1')
        .setRequired(true);

      const inputDesc = new TextInputBuilder()
        .setCustomId('desconto')
        .setLabel('Desconto % (Ex: 0 para nenhum ou 30 para clã)')
        .setStyle(TextInputStyle.Short)
        .setValue('0')
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputVendedor),
        new ActionRowBuilder().addComponents(inputArma),
        new ActionRowBuilder().addComponents(inputQtd),
        new ActionRowBuilder().addComponents(inputDesc)
      );

      return interaction.showModal(modal);
    }
  }

  // RECEBIMENTO DE SUBMISSÃO DOS MODAIS DO DISCORD
  if (interaction.isModalSubmit()) {
    const customId = interaction.customId;

    if (customId === 'modal_addaco') {
      const quantidade = parseInt(interaction.fields.getTextInputValue('aco_quantidade'));

      if (isNaN(quantidade) || quantidade <= 0) {
        return interaction.reply({ content: '❌ **Quantidade inválida!** Digite apenas números inteiros maiores que zero.', ephemeral: true });
      }

      const pctKits = db.config.percentSteelForKits || 30;
      const pctSales = db.config.percentSteelForSales || 70;
      const addKits = Math.floor(quantidade * (pctKits / 100));
      const addSales = quantidade - addKits;

      db.estoqueKits = (db.estoqueKits || 0) + addKits;
      db.estoqueVendas = (db.estoqueVendas || 0) + addSales;
      db.estoque += quantidade;
      salvarBanco();

      await interaction.reply({ content: `⛓️ **Sucesso!** Adicionado **+${formatarNumero(quantidade)} kg** ao baú.`, ephemeral: true });
      
      const embedPublico = new EmbedBuilder()
        .setTitle('⛓️ ENTRADA DE MATERIAL NO ESTOQUE')
        .setColor('#248046')
        .addFields(
          { name: '👤 Responsável', value: `${interaction.user}`, inline: true },
          { name: '📦 Quantidade Adicionada', value: `**+${formatarNumero(quantidade)} kg**`, inline: true },
          { name: '📊 Divisão do Baú', value: `Vendas: **+${formatarNumero(addSales)} kg** | Kits: **+${formatarNumero(addKits)} kg**`, inline: false },
          { name: '📊 Estoque Geral Atual', value: `**${formatarNumero(db.estoque)} kg**`, inline: true }
        )
        .setTimestamp();

      return interaction.channel.send({ embeds: [embedPublico] });
    }

    if (customId === 'modal_registrar_meta') {
      const quantidade = parseInt(interaction.fields.getTextInputValue('farme_quantidade'));

      if (isNaN(quantidade) || quantidade <= 0) {
        return interaction.reply({ content: '❌ **Quantidade inválida!** Digite apenas números inteiros maiores que zero.', ephemeral: true });
      }

      const pctKits = db.config.percentSteelForKits || 30;
      const pctSales = db.config.percentSteelForSales || 70;
      const addKits = Math.floor(quantidade * (pctKits / 100));
      const addSales = quantidade - addKits;

      db.estoqueKits = (db.estoqueKits || 0) + addKits;
      db.estoqueVendas = (db.estoqueVendas || 0) + addSales;
      db.estoque += quantidade;

      if (!db.farmes) db.farmes = [];
      const novoFarme = {
        id: `F-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toISOString(),
        userId: interaction.user.id,
        userName: interaction.user.username,
        quantidade
      };
      const acoAntes = obterAcoTotalUsuario(interaction.user.id);

      db.farmes.push(novoFarme);
      salvarBanco();

      const acoDepois = obterAcoTotalUsuario(interaction.user.id);
      checarMetaAtingida(interaction.user.id, acoAntes, acoDepois, interaction.channel);

      await interaction.reply({ content: `🚜 **Farme registrado com sucesso!** Adicionados **+${formatarNumero(quantidade)} kg** ao baú.`, ephemeral: true });

      const canalLogId = '1525698045537161226';
      let canalLog = client.channels.cache.get(canalLogId);
      if (!canalLog) {
        try {
          canalLog = await client.channels.fetch(canalLogId);
        } catch (e) {
          console.log(`Erro ao buscar canal de log ${canalLogId}:`, e.message);
        }
      }

      const embedLog = new EmbedBuilder()
        .setTitle('🚜 REGISTRO DE FARME DIÁRIO')
        .setColor('#10b981')
        .setDescription(`👤 **Membro:** ${interaction.user} (${interaction.user.username})\n📦 **Quantidade:** **${formatarNumero(quantidade)} kg** de aço\n📅 **Data:** <t:${Math.floor(Date.now() / 1000)}:f>`)
        .setTimestamp();

      if (canalLog) {
        await canalLog.send({ embeds: [embedLog] }).catch(err => {
          console.error('Erro ao enviar mensagem para o canal de log:', err);
        });
      }

      const embedPublico = new EmbedBuilder()
        .setTitle('🚜 NOVO FARME DIÁRIO REGISTRADO')
        .setColor('#a855f7')
        .setDescription(`👤 O membro ${interaction.user} registrou **${formatarNumero(quantidade)} kg** de aço no baú!`)
        .setTimestamp();

      return interaction.channel.send({ embeds: [embedPublico] });
    }

    if (customId === 'modal_subaco') {
      const quantidade = parseInt(interaction.fields.getTextInputValue('aco_quantidade'));

      if (isNaN(quantidade) || quantidade <= 0) {
        return interaction.reply({ content: '❌ **Quantidade inválida!** Digite apenas números inteiros maiores que zero.', ephemeral: true });
      }

      if (db.estoque < quantidade) {
        return interaction.reply({ content: `❌ **Estoque insuficiente!** O cofre de aço possui apenas **${formatarNumero(db.estoque)} kg**.`, ephemeral: true });
      }

      const pctKits = db.config.percentSteelForKits || 30;
      const pctSales = db.config.percentSteelForSales || 70;
      const subKits = Math.floor(quantidade * (pctKits / 100));
      const subSalesVal = quantidade - subKits;

      db.estoqueKits = Math.max(0, (db.estoqueKits || 0) - subKits);
      db.estoqueVendas = Math.max(0, (db.estoqueVendas || 0) - subSalesVal);
      db.estoque = db.estoqueKits + db.estoqueVendas;
      salvarBanco();

      await interaction.reply({ content: `⛓️ **Sucesso!** Retirado **-${formatarNumero(quantidade)} kg** proporcionalmente.`, ephemeral: true });
      
      const embedPublico = new EmbedBuilder()
        .setTitle('⛓️ RETIRADA DE MATERIAL NO ESTOQUE')
        .setColor('#da373c')
        .addFields(
          { name: '👤 Responsável', value: `${interaction.user}`, inline: true },
          { name: '📦 Quantidade Retirada', value: `**-${formatarNumero(quantidade)} kg**`, inline: true },
          { name: '📊 Divisão do Baú', value: `Vendas: **-${formatarNumero(subSalesVal)} kg** | Kits: **-${formatarNumero(subKits)} kg**`, inline: false },
          { name: '📊 Estoque Geral Atual', value: `**${formatarNumero(db.estoque)} kg**`, inline: true }
        )
        .setTimestamp();

      return interaction.channel.send({ embeds: [embedPublico] });
    }

    if (customId === 'modal_vender') {
      const vendedorInput = interaction.fields.getTextInputValue('vendedor_id');
      const armaChave = interaction.fields.getTextInputValue('arma_chave').toLowerCase().trim();
      const quantidade = parseInt(interaction.fields.getTextInputValue('quantidade'));
      const desconto = parseInt(interaction.fields.getTextInputValue('desconto')) || 0;

      let vendedorMembro = null;
      const cleanId = vendedorInput.replace(/[<@!>]/g, '');
      try {
        vendedorMembro = await interaction.guild.members.fetch(cleanId);
      } catch (e) {
        return interaction.reply({ content: '❌ **Vendedor não encontrado!** Verifique se o ID ou menção estão corretos.', ephemeral: true });
      }

      if (!vendedorMembro) {
        return interaction.reply({ content: '❌ **Vendedor inválido!**', ephemeral: true });
      }

      const arma = ARMAS[armaChave];
      if (!arma) {
        return interaction.reply({ content: '❌ **Arma inválida!** Opções disponíveis: \`ak47\`, \`awp\`, \`m16\`, \`sawedoff\`, \`glock17\`.', ephemeral: true });
      }

      if (isNaN(quantidade) || quantidade <= 0) {
        return interaction.reply({ content: '❌ **Quantidade inválida!**', ephemeral: true });
      }

      const acoNecessario = arma.aco * quantidade;
      const acoVendas = db.estoqueVendas !== undefined ? db.estoqueVendas : Math.floor(db.estoque * ((db.config.percentSteelForSales || 70) / 100));

      if (acoVendas < acoNecessario) {
        return interaction.reply({ content: `❌ **Aço para Vendas Insuficiente!** Necessário **${formatarNumero(acoNecessario)} kg** de aço para fabricação. O baú possui **${formatarNumero(acoVendas)} kg** reservado para vendas (Aço total no baú: **${formatarNumero(db.estoque)} kg**).`, ephemeral: true });
      }

      const precoBase = arma.preco * quantidade;
      const valorDesconto = precoBase * (desconto / 100);
      const totalVenda = precoBase - valorDesconto;
      const comissaoVendedor = totalVenda * (db.config.splitPercent / 100);
      const lucroClas = totalVenda - comissaoVendedor;

      db.estoqueVendas = acoVendas - acoNecessario;
      db.estoqueKits = db.estoqueKits !== undefined ? db.estoqueKits : Math.floor(db.estoque * ((db.config.percentSteelForKits || 30) / 100));
      db.estoque = db.estoqueKits + db.estoqueVendas;
      db.caixa += lucroClas;

      const novaVenda = {
        id: `V-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toISOString(),
        userId: vendedorMembro.id,
        userName: vendedorMembro.user.username,
        arma: arma.nome,
        quantidade,
        total: totalVenda,
        desconto,
        comissao: comissaoVendedor,
        acoConsumido: acoNecessario
      };

      const acoAntes = obterAcoTotalUsuario(vendedorMembro.id);

      db.vendas.push(novaVenda);
      salvarBanco();

      const acoDepois = obterAcoTotalUsuario(vendedorMembro.id);
      checarMetaAtingida(vendedorMembro.id, acoAntes, acoDepois, interaction.channel);

      await interaction.reply({ content: `🎯 Venda **${novaVenda.id}** lançada com sucesso no ERP!`, ephemeral: true });

      const embedSucesso = new EmbedBuilder()
        .setTitle('🎯 VENDA REGISTRADA COM SUCESSO')
        .setColor('#10b981')
        .addFields(
          { name: '👤 Vendedor', value: `${vendedorMembro}`, inline: true },
          { name: '🔫 Armamento', value: `**${quantidade}x ${arma.nome}**`, inline: true },
          { name: '📉 Desconto', value: `**${desconto}%**`, inline: true },
          { name: '💰 Total Pago', value: `**${formatarMoeda(totalVenda)}**` },
          { name: '💸 Split Vendedor', value: `**${formatarMoeda(comissaoVendedor)}** (Comissão de ${db.config.splitPercent}%)`, inline: true },
          { name: '🏦 Cofre HUNTERS', value: `**+${formatarMoeda(lucroClas)}** (Fundo de ${100 - db.config.splitPercent}%)`, inline: true },
          { name: '⛓️ Aço de Vendas Consumido', value: `**-${formatarNumero(acoNecessario)} kg**`, inline: true }
        )
        .setFooter({ text: `ID: ${novaVenda.id} • Lançado via Painel Interativo` })
        .setTimestamp();

      return interaction.channel.send({ embeds: [embedSucesso] });
    }
  }
});

// =========================================================================
// 🚀 INICIALIZAÇÃO DO BOT
// =========================================================================

if (TOKEN) {
  client.login(TOKEN).catch(err => {
    console.error('❌ Erro de login no Discord. Verifique o TOKEN:', err.message);
  });
} else {
  console.error('❌ ERRO CRÍTICO: Variável DISCORD_TOKEN ou TOKEN não encontrada no seu ambiente!');
}
