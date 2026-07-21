/**
 * 🐺 HUNTERS ERP - DISCORD BOT TÁTICO v4.5 (STANDALONE OFICIAL)
 * 
 * Script completo e otimizado com suporte a:
 *  - Painel de Gerente (Botão e Modal de Ajuste Total para Gerentes)
 *  - Escolha de Origem do Aço na Venda: Aço do Baú vs Aço na Mão
 *  - Kits de Armas Oficiais & Kits de Venda Táticos Separados
 *  - Tabela Oficial com Requisitos de Aço (AK: 2700kg, AWP: 3000kg, etc.)
 *  - Cálculo Automático de Lucro Líquido por Transação
 *  - Saldo em Banco Inicial R$ 868.392,00
 *  - Envio de Logs no canal oficial: "1525698045537161226"
 * 
 * ⚙️ REQUISITOS:
 *   - Node.js v16.11.0 ou superior
 *   - Dependências: npm install discord.js dotenv
 * 
 * ⚙️ CONFIGURAÇÃO:
 *   1. Crie um arquivo `.env` na mesma pasta do script:
 *      DISCORD_TOKEN=SEU_TOKEN_AQUI
 *   2. Inicie o bot: node bot.js
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
  ActivityType
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

// CONFIGURAÇÕES GERAIS DO CLÃ
const CONFIG = {
  PREFIX: '!',
  CANAL_AVISOS_ID: '1515125864033943712',
  CARGO_NOTIFICAR_ID: '1515125826780135485',
  CANAL_PAINEL_ID: '1523844178151473193',
  CANAL_TABELA_PRECOS_ID: '1523478101940506744',
  CANAL_LOG_METAS_ID: '1525698045537161226', // Canal oficial solicitado
  CARGO_GERENTE_ID: '1523277774436171796',
  META_ACO_KG: 8000,
  CUSTO_KIT_KG: 3375,
  SPLIT_CLAN_PERCENT: 30, // 30% Comissão Membro, 70% Clã
  CUSTO_ACO_POR_KG: 4.50 // Custo estimado para cálculo do Lucro Líquido
};

// TABELA DE ARMAS, KITS E REQUISITOS DE AÇO / PREÇOS
const ARMAS = {
  // --- KITS DE ARMAS OFICIAIS ---
  kit_armas_novo: { 
    nome: "Kit de Armas Completo (AK + Glock + Munições + Acessórios)", 
    preco: 69000, 
    aco: 3375,
    descricao: "1x AK-47 + 1x Glock 17 + 3x Box 5.56 + 3x Box Pistola + 1x Grip + 1x Silenciador + 1x Carregador Estendido"
  },
  kit_armas_pistolas: {
    nome: "Kit de Armas Pistola & Sub (Glock 17 + TEC-9 + Box Pistola + Box Sub)",
    preco: 25000,
    aco: 1140,
    descricao: "1x Glock 17 + 1x TEC-9 + 2x Box Pistola + 2x Box Sub"
  },

  // --- KITS DE VENDA TÁTICOS ---
  kit_venda_basico: {
    nome: "Kit de Venda Básico (AK-47 + Box 5.56 + Silenciador)",
    preco: 42000,
    aco: 2840,
    descricao: "1x AK-47 + 1x Box M. 5.56 + 1x Silenciador"
  },
  kit_venda_acao: {
    nome: "Kit de Venda Ação / Snipe (AK-47 + AWP + Box 5.56 + Box .308 + Grip)",
    preco: 115000,
    aco: 6050,
    descricao: "1x AK-47 + 1x AWP + 2x Box 5.56 + 2x Box .308 + 1x Grip"
  },
  kit_venda_invasao: {
    nome: "Kit de Venda Invasão (2x AK-47 + 2x Glock + 4x Box 5.56 + 2x Grip)",
    preco: 92000,
    aco: 6180,
    descricao: "2x AK-47 + 2x Glock 17 + 4x Box 5.56 + 2x Grip"
  },

  // --- ARMAS INDIVIDUAIS ---
  ak47: { nome: "AK-47", preco: 35000, aco: 2700 },
  awp: { nome: "AWP", preco: 65000, aco: 3000 },
  m16: { nome: "M16", preco: 35000, aco: 2700 },
  sawnoff: { nome: "Sawed-Off Shotgun", preco: 20000, aco: 1200 },
  glock17: { nome: "Glock 17", preco: 5000, aco: 120 },
  tec9: { nome: "TEC-9", preco: 15000, aco: 900 },
  taser: { nome: "Taser", preco: 10000, aco: 700 },

  // --- ACESSÓRIOS ---
  silenciador: { nome: "Silenciador", preco: 2000, aco: 20 },
  carregador_est: { nome: "Carregador Estendido", preco: 3000, aco: 25 },
  grip: { nome: "Grip para AK/Fuzil", preco: 3000, aco: 30 },
  lanterna: { nome: "Lanterna Tática", preco: 2000, aco: 30 },
  
  // --- CAIXAS DE MUNIÇÃO ---
  box_m_pistola: { nome: "Box M. Pistola", preco: 2000, aco: 40 },
  box_m_sub: { nome: "Box M. Submetralhadora", preco: 3000, aco: 80 },
  box_m_escopeta: { nome: "Box M. Escopeta", preco: 4000, aco: 100 },
  box_m_556: { nome: "Box M. 5.56", preco: 5000, aco: 120 },
  box_m_308: { nome: "Box M. .308", preco: 5000, aco: 200 },

  // --- MUNIÇÕES (CAIXA COM 10) ---
  muni_pistola: { nome: "Munição Pistola (10x)", preco: 2000, aco: 10 },
  muni_smg: { nome: "Munição SMG (10x)", preco: 3000, aco: 20 },
  muni_escopeta: { nome: "Munição Escopeta (10x)", preco: 4000, aco: 25 },
  muni_fuzil: { nome: "Munição Fuzil (10x)", preco: 5000, aco: 30 }
};

// INICIALIZAÇÃO DO BANCO DE DADOS LOCAL ( hunters-db.json )
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'hunters-db.json');

let db = {
  bancoDinheiro: 868392.00, // Saldo inicial informado
  estoque: {
    acoBau: 69000,     // Aço no Baú do Clã
    acoMaoTotal: 12500, // Aço na Mão dos Membros
    kitsMontados: 8     // Kits de Armas completos prontos
  },
  vendas: [],
  farmes: [],
  retiradas: [],
  config: { ...CONFIG },
  painelCanalId: null,
  painelMensagemId: null,
  tabelaMensagemId: null
};

// Carregar dados salvos
function carregarBanco() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const loaded = JSON.parse(data);
      db = { ...db, ...loaded };
      console.log('💾 [HUNTERS] Banco de dados carregado com sucesso!');
    } else {
      salvarBanco();
      console.log('💾 [HUNTERS] Novo banco de dados Hunters ERP criado!');
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

// FORMATADORES DE TEXTO
const formatarMoeda = (val) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(val);
};
const formatarNumero = (val) => {
  return new Intl.NumberFormat('pt-BR').format(val);
};

// CÁLCULO DE LUCRO LÍQUIDO
function calcularLucroLiquido(valorBruto, acoConsumidoKg) {
  const comissaoMembro = (valorBruto * (db.config.SPLIT_CLAN_PERCENT || 30)) / 100;
  const receitaClanBruta = valorBruto - comissaoMembro;
  const custoInsumos = acoConsumidoKg * (db.config.CUSTO_ACO_POR_KG || 4.50);
  const lucroLiquidoClan = receitaClanBruta - custoInsumos;
  const lucroLiquidoPercent = valorBruto > 0 ? (lucroLiquidoClan / valorBruto) * 100 : 0;

  return {
    comissaoMembro,
    receitaClanBruta,
    custoInsumos,
    lucroLiquidoClan,
    lucroLiquidoPercent
  };
}

// CLIENT DO DISCORD
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// VERIFICAR META E REGISTRAR LOG NO CANAL 1525698045537161226
async function registrarLogDiscord(guild, titulo, descricao, campos, cor = 0xa855f7) {
  const canalLogId = db.config.CANAL_LOG_METAS_ID || '1525698045537161226';
  const canalLog = guild.channels.cache.get(canalLogId) 
    || await guild.channels.fetch(canalLogId).catch(() => null);

  if (canalLog) {
    const embed = new EmbedBuilder()
      .setTitle(titulo)
      .setColor(cor)
      .setDescription(descricao)
      .addFields(campos)
      .setFooter({ text: 'Hunters ERP • Canal Log 1525698045537161226' })
      .setTimestamp();

    await canalLog.send({
      content: `🚨 **NOVO REGISTRO HUNTERS ERP - CANAL 1525698045537161226**`,
      embeds: [embed]
    }).catch(() => null);
  }
}

// GERAR PAINEL OPERACIONAL COMPLETO
function obterPainelPayload() {
  const metaObjetivo = db.config.META_ACO_KG || 8000;
  const totalFarmado = db.farmes.reduce((acc, f) => acc + f.quantidade, 0);
  const totalVendidoBruto = db.vendas.reduce((acc, v) => acc + v.valorTotalBruto, 0);
  const totalLucroLiquido = db.vendas.reduce((acc, v) => acc + v.lucroLiquidoClan, 0);

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
 🎯 META SEMANAL POR MEMBRO: .... ${formatarNumero(metaObjetivo)} kg
\`\`\``)
    .addFields(
      { name: '📍 Canal de Logs Oficiais', value: `<#${db.config.CANAL_LOG_METAS_ID}> (\`1525698045537161226\`)`, inline: true },
      { name: '🛠️ Kit de Armas Completo', value: `\`AK-47 + Glock 17 + 3x Box 5.56 + 3x Box Pistola + Grip + Silenciador + Carregador\``, inline: false }
    )
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

  return { embeds: [embed], components: [rowAcoes, rowConsultas] };
}

// ATUALIZAR PAINEL DISCORD
async function atualizarPainel(guild) {
  try {
    const canalId = db.painelCanalId || db.config.CANAL_PAINEL_ID;
    if (!canalId) return;

    const canal = guild.channels.cache.get(canalId) 
      || await guild.channels.fetch(canalId).catch(() => null);

    if (!canal) return;

    const payload = obterPainelPayload();

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
    console.error('Erro ao atualizar painel:', err.message);
  }
}

// EVENTO READY
client.once('ready', async () => {
  console.log(`🤖 [HUNTERS] Bot Online como ${client.user.tag}!`);
  carregarBanco();
  client.user.setActivity('Hunters ERP • Logística Tática', { type: ActivityType.Playing });

  client.guilds.cache.forEach(async (guild) => {
    await atualizarPainel(guild);
  });
});

// INTERAÇÕES DE BOTÕES E MODAIS
client.on('interactionCreate', async (interaction) => {
  const { user, guild } = interaction;
  if (!guild) return;

  // BOTÕES
  if (interaction.isButton()) {

    // BOTÃO: ENTREGAR FARME
    if (interaction.customId === 'btn_farme') {
      const modal = new ModalBuilder()
        .setCustomId('modal_farme')
        .setTitle('📦 Entregar Farme de Aço');

      const inputQtd = new TextInputBuilder()
        .setCustomId('farme_qtd')
        .setLabel('Quantidade de Aço (em kg)')
        .setPlaceholder('Ex: 1000')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const inputOrigem = new TextInputBuilder()
        .setCustomId('farme_destino')
        .setLabel('Destino do Aço: Digite "bau" ou "mao"')
        .setValue('bau')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputQtd),
        new ActionRowBuilder().addComponents(inputOrigem)
      );
      await interaction.showModal(modal);
    }

    // BOTÃO: REGISTRAR VENDA
    if (interaction.customId === 'btn_venda') {
      const modal = new ModalBuilder()
        .setCustomId('modal_venda')
        .setTitle('💰 Registrar Venda no Arsenal');

      const inputItem = new TextInputBuilder()
        .setCustomId('venda_item')
        .setLabel('ID do Item (kit_armas_novo, ak47, awp, etc.)')
        .setValue('kit_armas_novo')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const inputQtd = new TextInputBuilder()
        .setCustomId('venda_qtd')
        .setLabel('Quantidade Vendida')
        .setValue('1')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const inputOrigemAco = new TextInputBuilder()
        .setCustomId('venda_origem')
        .setLabel('Origem do Aço: Digite "bau" ou "mao"')
        .setValue('bau')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputItem),
        new ActionRowBuilder().addComponents(inputQtd),
        new ActionRowBuilder().addComponents(inputOrigemAco)
      );
      await interaction.showModal(modal);
    }

    // BOTÃO: PAINEL GERENTE (AJUSTE COMPLETO PARA GERENTES)
    if (interaction.customId === 'btn_admin') {
      const modal = new ModalBuilder()
        .setCustomId('modal_admin')
        .setTitle('⚙️ Painel Gerencial • Ajuste Total');

      const inputBanco = new TextInputBuilder()
        .setCustomId('admin_banco')
        .setLabel('Saldo do Banco de Dinheiro (R$)')
        .setValue(String(db.bancoDinheiro))
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const inputAcoBau = new TextInputBuilder()
        .setCustomId('admin_acobau')
        .setLabel('Aço no Baú do Clã (kg)')
        .setValue(String(db.estoque.acoBau))
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const inputAcoMao = new TextInputBuilder()
        .setCustomId('admin_acomao')
        .setLabel('Aço na Mão dos Membros (kg)')
        .setValue(String(db.estoque.acoMaoTotal))
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const inputKits = new TextInputBuilder()
        .setCustomId('admin_kits')
        .setLabel('Kits de Armas Montados')
        .setValue(String(db.estoque.kitsMontados))
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputBanco),
        new ActionRowBuilder().addComponents(inputAcoBau),
        new ActionRowBuilder().addComponents(inputAcoMao),
        new ActionRowBuilder().addComponents(inputKits)
      );
      await interaction.showModal(modal);
    }

    // BOTÃO: TABELA DE PREÇOS
    if (interaction.customId === 'btn_arsenal') {
      const embed = new EmbedBuilder()
        .setTitle('🛒 TABELA DE ITENS & REQUISITOS DE AÇO — HUNTERS')
        .setColor('#a855f7')
        .setDescription(`⚔️ **KITS OFICIAIS HUNTERS:**
⭐ **Kit de Armas Completo (\`kit_armas_novo\`)** — R$ 69.000 | 🛠️ 3.375 Aços
🔫 **Kit Pistolas & Sub (\`kit_armas_pistolas\`)** — R$ 25.000 | 🛠️ 1.140 Aços
📦 **Kit Venda Básico (\`kit_venda_basico\`)** — R$ 42.000 | 🛠️ 2.840 Aços
🎯 **Kit Venda Ação / Snipe (\`kit_venda_acao\`)** — R$ 115.000 | 🛠️ 6.050 Aços
🔥 **Kit Venda Invasão (\`kit_venda_invasao\`)** — R$ 92.000 | 🛠️ 6.180 Aços

🔫 **ARMAS INDIVIDUAIS:**
• 🔫 **AK-47 (\`ak47\`)** — R$ 35.000 (Desc 15%: R$ 29.750) | 🛠️ 2.700 Aços
• 🎯 **AWP (\`awp\`)** — R$ 65.000 (Desc 15%: R$ 55.250) | 🛠️ 3.000 Aços
• 🔫 **M16 (\`m16\`)** — R$ 35.000 (Desc 15%: R$ 29.750) | 🛠️ 2.700 Aços
• 🔫 **Sawed-Off Shotgun (\`sawnoff\`)** — R$ 20.000 (Desc 15%: R$ 17.000) | 🛠️ 1.200 Aços
• 🔫 **Glock 17 (\`glock17\`)** — R$ 5.000 (Desc 15%: R$ 4.250) | 🛠️ 120 Aços
• 🔫 **TEC-9 (\`tec9\`)** — R$ 15.000 (Desc 15%: R$ 12.750) | 🛠️ 900 Aços
• ⚡ **Taser (\`taser\`)** — R$ 10.000 (Desc 15%: R$ 8.500) | 🛠️ 700 Aços

🔩 **ACESSÓRIOS:**
• 🤫 **Silenciador (\`silenciador\`)** — R$ 2.000 (Desc 15%: R$ 1.700) | 🛠️ 20 Aços
• 🔩 **Carregador Estendido (\`carregador_est\`)** — R$ 3.000 (Desc 15%: R$ 2.550) | 🛠️ 25 Aços
• 🔦 **Grip (\`grip\`)** — R$ 3.000 (Desc 15%: R$ 2.550) | 🛠️ 30 Aços
• 🔦 **Lanterna Tática (\`lanterna\`)** — R$ 2.000 (Desc 15%: R$ 1.700) | 🛠️ 30 Aços

📦 **CAIXAS DE MUNIÇÃO:**
• 📦 **Box M. Pistola (\`box_m_pistola\`)** — R$ 2.000 (Desc 15%: R$ 1.700) | 🛠️ 40 Aços
• 📦 **Box M. Submetralhadora (\`box_m_sub\`)** — R$ 3.000 (Desc 15%: R$ 2.550) | 🛠️ 80 Aços
• 📦 **Box M. Escopeta (\`box_m_escopeta\`)** — R$ 4.000 (Desc 15%: R$ 3.400) | 🛠️ 100 Aços
• 📦 **Box M. 5.56 (\`box_m_556\`)** — R$ 5.000 (Desc 15%: R$ 4.250) | 🛠️ 120 Aços
• 📦 **Box M. .308 (\`box_m_308\`)** — R$ 5.000 (Desc 15%: R$ 4.250) | 🛠️ 200 Aços`);

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  // ENVIO DOS MODAIS
  if (interaction.type === InteractionType.ModalSubmit) {

    // SUBMIT: FARME
    if (interaction.customId === 'modal_farme') {
      await interaction.deferReply({ ephemeral: true });
      const qtd = parseInt(interaction.fields.getTextInputValue('farme_qtd'));
      const destinoInput = interaction.fields.getTextInputValue('farme_destino').toLowerCase().trim();
      const destino = destinoInput === 'mao' ? 'mao' : 'bau';

      if (isNaN(qtd) || qtd <= 0) {
        return interaction.editReply({ content: '❌ Digite uma quantidade válida de aço.' });
      }

      if (destino === 'bau') {
        db.estoque.acoBau += qtd;
      } else {
        db.estoque.acoMaoTotal += qtd;
      }

      db.farmes.push({
        id: `f_${Date.now()}`,
        userId: user.id,
        userName: user.username,
        quantidade: qtd,
        destinoAco: destino,
        data: new Date().toISOString()
      });

      salvarBanco();

      await interaction.editReply({
        content: `✅ **Farme Registrado!** Depósito de **${formatarNumero(qtd)} kg** de aço no **${destino === 'bau' ? 'Baú do Clã' : 'Aço na Mão'}**.`
      });

      // Enviar Log no canal 1525698045537161226
      await registrarLogDiscord(
        guild,
        '🌾 REGISTRO DE FARME DE AÇO',
        `Entrega de aço efetuada com sucesso no sistema.`,
        [
          { name: '👤 Member Farmer', value: `<@${user.id}> (${user.username})`, inline: true },
          { name: '🧱 Quantidade', value: `**${formatarNumero(qtd)} kg**`, inline: true },
          { name: '📍 Destino do Aço', value: destino === 'bau' ? 'Aço do Baú' : 'Aço na Mão', inline: true }
        ],
        0xa855f7
      );

      await atualizarPainel(guild);
    }

    // SUBMIT: VENDA (com cálculo automático de Lucro Líquido)
    if (interaction.customId === 'modal_venda') {
      await interaction.deferReply({ ephemeral: true });
      const itemId = interaction.fields.getTextInputValue('venda_item').toLowerCase().trim();
      const qtd = parseInt(interaction.fields.getTextInputValue('venda_qtd'));
      const origemInput = interaction.fields.getTextInputValue('venda_origem').toLowerCase().trim();
      const origemAco = origemInput === 'mao' ? 'mao' : 'bau';

      const item = ARMAS[itemId] || ARMAS['kit_armas_novo'];
      const acoTotalKg = item.aco * qtd;
      const valorTotalBruto = item.preco * qtd;

      // Verificar disponibilidade do Aço na origem escolhida
      const disponivel = origemAco === 'bau' ? db.estoque.acoBau : db.estoque.acoMaoTotal;
      if (disponivel < acoTotalKg) {
        return interaction.editReply({
          content: `❌ **Aço Insuficiente no ${origemAco === 'bau' ? 'Baú' : 'Aço na Mão'}!** Necessário: **${formatarNumero(acoTotalKg)} kg**. Disponível: **${formatarNumero(disponivel)} kg**.`
        });
      }

      // Descontar aço da origem selecionada
      if (origemAco === 'bau') {
        db.estoque.acoBau -= acoTotalKg;
      } else {
        db.estoque.acoMaoTotal -= acoTotalKg;
      }

      // Se for kit montado, ajusta contador de kits
      if (itemId === 'kit_armas_novo' && db.estoque.kitsMontados > 0) {
        db.estoque.kitsMontados = Math.max(0, db.estoque.kitsMontados - qtd);
      }

      // Calcular Lucro Líquido
      const lucroCalc = calcularLucroLiquido(valorTotalBruto, acoTotalKg);

      // Creditar Lucro Líquido do Clã no Banco de Dinheiro
      db.bancoDinheiro += lucroCalc.lucroLiquidoClan;

      db.vendas.push({
        id: `v_${Date.now()}`,
        userId: user.id,
        userName: user.username,
        itemId: itemId,
        itemName: item.nome,
        quantidade: qtd,
        origemAco: origemAco,
        acoConsumidoTotal: acoTotalKg,
        valorTotalBruto: valorTotalBruto,
        comissaoMembro: lucroCalc.comissaoMembro,
        receitaClan: lucroCalc.receitaClanBruta,
        custoEstimadoInsumos: lucroCalc.custoInsumos,
        lucroLiquidoClan: lucroCalc.lucroLiquidoClan,
        lucroLiquidoPercent: lucroCalc.lucroLiquidoPercent,
        data: new Date().toISOString()
      });

      salvarBanco();

      await interaction.editReply({
        content: `✅ **Venda Registrada com Sucesso!**
📦 **Item:** \`${item.nome}\` (${qtd}x)
🧱 **Aço Descontado do ${origemAco === 'bau' ? 'Baú' : 'Aço na Mão'}:** \`${formatarNumero(acoTotalKg)} kg\`
💰 **Faturamento Bruto:** \`${formatarMoeda(valorTotalBruto)}\`
🟢 **LUCRO LÍQUIDO CREDITADO NO BANCO:** \`${formatarMoeda(lucroCalc.lucroLiquidoClan)}\` (+${lucroCalc.lucroLiquidoPercent.toFixed(1)}% margem)`
      });

      // Enviar Log Oficial no canal 1525698045537161226
      await registrarLogDiscord(
        guild,
        '🛒 REGISTRO DE VENDA • HUNTERS ERP',
        `Nova venda processada com cálculo de lucro líquido e desconto de aço.`,
        [
          { name: '👤 Membro Vendedor', value: `<@${user.id}> (${user.username})`, inline: true },
          { name: '📦 Equipamento', value: `${item.nome} (${qtd}x)`, inline: true },
          { name: '🧱 Origem do Aço', value: origemAco === 'bau' ? 'Aço do Baú' : 'Aço na Mão', inline: true },
          { name: '💰 Faturamento Bruto', value: formatarMoeda(valorTotalBruto), inline: true },
          { name: '🟢 Lucro Líquido Clã', value: `**${formatarMoeda(lucroCalc.lucroLiquidoClan)}**`, inline: true },
          { name: '💵 Novo Saldo Banco', value: `**${formatarMoeda(db.bancoDinheiro)}**`, inline: true }
        ],
        0x10b981
      );

      await atualizarPainel(guild);
    }

    // SUBMIT: GERÊNCIA / PAINEL ADMIN
    if (interaction.customId === 'modal_admin') {
      await interaction.deferReply({ ephemeral: true });

      const novoBanco = parseFloat(interaction.fields.getTextInputValue('admin_banco'));
      const novoAcoBau = parseInt(interaction.fields.getTextInputValue('admin_acobau'));
      const novoAcoMao = parseInt(interaction.fields.getTextInputValue('admin_acomao'));
      const novosKits = parseInt(interaction.fields.getTextInputValue('admin_kits'));

      if (!isNaN(novoBanco)) db.bancoDinheiro = novoBanco;
      if (!isNaN(novoAcoBau)) db.estoque.acoBau = novoAcoBau;
      if (!isNaN(novoAcoMao)) db.estoque.acoMaoTotal = novoAcoMao;
      if (!isNaN(novosKits)) db.estoque.kitsMontados = novosKits;

      salvarBanco();

      await interaction.editReply({
        content: `⚙️ **Alterações Gerenciais Salvas com Sucesso!**
💵 **Novo Banco de Dinheiro:** \`${formatarMoeda(db.bancoDinheiro)}\`
📦 **Aço no Baú do Clã:** \`${formatarNumero(db.estoque.acoBau)} kg\`
✋ **Aço na Mão dos Membros:** \`${formatarNumero(db.estoque.acoMaoTotal)} kg\`
🔥 **Kits Montados Prontos:** \`${db.estoque.kitsMontados} Kits\``
      });

      // Registrar Log no canal oficial 1525698045537161226
      await registrarLogDiscord(
        guild,
        '⚙️ ALTERAÇÃO GERENCIAL NO SISTEMA',
        `Um gerente atualizou os parâmetros globais do Hunters ERP.`,
        [
          { name: '👤 Gerente Responsável', value: `<@${user.id}> (${user.username})`, inline: true },
          { name: '💵 Banco de Dinheiro', value: formatarMoeda(db.bancoDinheiro), inline: true },
          { name: '📦 Aço Baú / Mão', value: `${formatarNumero(db.estoque.acoBau)} kg / ${formatarNumero(db.estoque.acoMaoTotal)} kg`, inline: true },
          { name: '🔥 Kits Montados', value: `${db.estoque.kitsMontados} Kits`, inline: true }
        ],
        0x3b82f6
      );

      await atualizarPainel(guild);
    }
  }
});

// CONEXÃO COM O DISCORD
if (process.env.DISCORD_TOKEN) {
  client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("❌ [HUNTERS] Falha ao conectar no Discord:", err.message);
  });
} else {
  console.log("⚠️ [HUNTERS] DISCORD_TOKEN não encontrado no .env");
}
