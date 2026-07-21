/**
 * 🐺 HUNTERS ERP - DISCORD BOT TÁTICO v4.5 (STANDALONE OFICIAL)
 * 
 * Script completo e otimizado com suporte a:
 *  - Escolha de Origem do Aço na Venda: Aço do Baú vs Aço na Mão
 *  - Registro do Novo Kit de Armas Completo (AK + Glock + 3x Box 5.56 + 3x Box Pistola + Grip + Silenciador + Carregador Estendido)
 *  - Cálculo Automático de Lucro Líquido por transação
 *  - Saldo em Banco Inicial R$ 868.392,00
 *  - Envio de Registros no canal oficial: 1525698045537161226
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
  CANAL_LOG_METAS_ID: '1525698045537161226', // Canal oficial de logs
  CARGO_GERENTE_ID: '1523277774436171796',
  META_ACO_KG: 8000,
  CUSTO_KIT_KG: 3375,
  SPLIT_CLAN_PERCENT: 30, // 30% Comissão Membro, 70% Clã
  CUSTO_ACO_POR_KG: 4.50 // Custo estimado por kg para cálculo do Lucro Líquido
};

// TABELA DE ARMAS, KITS E REQUISITOS DE AÇO / PREÇOS
const ARMAS = {
  // --- KITS ESPECIAS ---
  kit_armas_novo: { 
    nome: "Kit de Armas Completo (AK + Glock + Munições + Acessórios)", 
    preco: 69000, 
    aco: 3375,
    descricao: "1x AK-47 + 1x Glock 17 + 3x Box 5.56 + 3x Box Pistola + 1x Grip + 1x Silenciador + 1x Carregador Estendido"
  },

  // --- ARMAS ---
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
  box_m_sub: { nome: "Box M. Sub", preco: 3000, aco: 80 },
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
  bancoDinheiro: 868392.00, // Saldo inicial configurado
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
  painelMensagemId: null
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

// REGISTRAR LOG NO CANAL 1525698045537161226
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

// GERAR PAINEL OPERACIONAL
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
      { name: '🛠️ Kit de Armas Atualizado', value: `\`AK-47 + Glock 17 + 3x Box 5.56 + 3x Box Pistola + Grip + Silenciador + Carregador\``, inline: false }
    )
    .setFooter({ text: 'Hunters ERP • Sorte aos Fortes 🐺' })
    .setTimestamp();

  const rowAcoes = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_farme').setLabel('Entregar Farme').setStyle(ButtonStyle.Success).setEmoji('📦'),
    new ButtonBuilder().setCustomId('btn_venda').setLabel('Registrar Venda').setStyle(ButtonStyle.Primary).setEmoji('💰'),
    new ButtonBuilder().setCustomId('btn_retirar').setLabel('Retirar Aço').setStyle(ButtonStyle.Danger).setEmoji('📤')
  );

  const rowConsultas = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_arsenal').setLabel('Tabela de Preços').setStyle(ButtonStyle.Secondary).setEmoji('🔫')
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

// INTERAÇÕES
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
        .setPlaceholder('bau = Baú do Clã | mao = Na Mão do Membro')
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
        .setLabel('ID do Item (Ex: kit_armas_novo, ak47, awp)')
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
        .setPlaceholder('bau = Descontar do Baú | mao = Descontar da Mão')
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

    // BOTÃO: TABELA DE PREÇOS
    if (interaction.customId === 'btn_arsenal') {
      const embed = new EmbedBuilder()
        .setTitle('🔫 TABELA OFICIAL DE PREÇOS & AÇO — HUNTERS')
        .setColor('#a855f7')
        .setDescription(`⭐ **Kit de Armas Completo (kit_armas_novo)** — R$ 69.000 | 3.375 kg de Aço
  ↳ *1x AK-47 + 1x Glock 17 + 3x Box 5.56 + 3x Box Pistola + 1x Grip + 1x Silenciador + 1x Carregador Estendido*

🔫 **AK-47 (ak47)** — R$ 35.000 | 2.700 kg
🎯 **AWP (awp)** — R$ 65.000 | 3.000 kg
🔫 **Glock 17 (glock17)** — R$ 5.000 | 120 kg
📦 **Box M. 5.56 (box_m_556)** — R$ 5.000 | 120 kg
📦 **Box M. Pistola (box_m_pistola)** — R$ 2.000 | 40 kg`);

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  // SUBMIT DOS MODAIS
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

    // SUBMIT: VENDA
    if (interaction.customId === 'modal_venda') {
      await interaction.deferReply({ ephemeral: true });
      const itemId = interaction.fields.getTextInputValue('venda_item').toLowerCase().trim();
      const qtd = parseInt(interaction.fields.getTextInputValue('venda_qtd'));
      const origemInput = interaction.fields.getTextInputValue('venda_origem').toLowerCase().trim();
      const origemAco = origemInput === 'mao' ? 'mao' : 'bau';

      const item = ARMAS[itemId] || ARMAS['kit_armas_novo'];
      const acoTotalKg = item.aco * qtd;
      const valorTotalBruto = item.preco * qtd;

      const disponivel = origemAco === 'bau' ? db.estoque.acoBau : db.estoque.acoMaoTotal;
      if (disponivel < acoTotalKg) {
        return interaction.editReply({
          content: `❌ **Aço Insuficiente no ${origemAco === 'bau' ? 'Baú' : 'Aço na Mão'}!** Necessário: **${formatarNumero(acoTotalKg)} kg**. Disponível: **${formatarNumero(disponivel)} kg**.`
        });
      }

      if (origemAco === 'bau') {
        db.estoque.acoBau -= acoTotalKg;
      } else {
        db.estoque.acoMaoTotal -= acoTotalKg;
      }

      if (itemId === 'kit_armas_novo' && db.estoque.kitsMontados > 0) {
        db.estoque.kitsMontados = Math.max(0, db.estoque.kitsMontados - qtd);
      }

      const lucroCalc = calcularLucroLiquido(valorTotalBruto, acoTotalKg);
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
🟢 **LUCRO LÍQUIDO CREDITADO NO BANCO:** \`${formatarMoeda(lucroCalc.lucroLiquidoClan)}\``
      });

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
