/**
 * 🐺 HUNTERS ERP - DISCORD BOT CENTRALIZADO (v4.0)
 * 
 * Script completo pronto para rodar.
 * Desenvolvido para o Clã Hunters. Mantém o controle de estoque, 
 * finanças, comissões de vendas, metas semanais e avisos de meta.
 * 
 * Requisitos:
 *   - Node.js v16.11.0 ou superior
 *   - Dependências: npm install discord.js dotenv
 */

const { 
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
} = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// CONFIGURAÇÕES GERAIS DO CLÃ (Valores padrão)
const CONFIG = {
  PREFIX: '!',
  CANAL_AVISOS_ID: '1515125864033943712',
  CARGO_NOTIFICAR_ID: '1515125826780135485',
  CANAL_PAINEL_ID: '1523844178151473193',
  META_ACO_KG: 8000,
  CUSTO_KIT_KG: 3260,
  SPLIT_CLAN_PERCENT: 50, // 50% Clã, 50% Membro
  PERCENT_STEEL_FOR_KITS: 60, // 60% para kits
  PERCENT_STEEL_FOR_SALES: 40 // 40% para vendas
};

// TABELA DE ARMAS, CUSTOS DE AÇO E PREÇOS
const ARMAS = {
  ak47: { nome: "AK-47", aco: 1000, preco: 180000 },
  m4a1: { nome: "M4A1", aco: 1200, preco: 210000 },
  g36: { nome: "G36", aco: 900, preco: 160000 },
  smg: { nome: "SMG", aco: 700, preco: 120000 },
  glock: { nome: "Glock", aco: 300, preco: 45000 },
  five_seven: { nome: "Five-Seven", aco: 400, preco: 60000 },
  tec9: { nome: "Tec-9", aco: 450, preco: 65000 },
  hk45: { nome: "HK-45", aco: 350, preco: 50000 }
};

// COMPONENTES DOS KITS DA META
const KIT_META_ITENS = {
  ak47: { nome: "1x AK-47", aco: 1000, quantidade: 1 },
  coletes: { nome: "5x Coletes Táticos", aco: 1500, quantidade: 5 },
  municao: { nome: "250x Munições de Fuzil", aco: 760, quantidade: 250 }
};

// INICIALIZAÇÃO DO BANCO DE DADOS LOCAL (hunters-db.json)
const DB_FILE = path.join(__dirname, 'hunters-db.json');
let db = {
  estoque: 150000, // estoque inicial em kg
  estoqueKits: 90000,
  estoqueVendas: 60000,
  caixa: 15000000, // caixa inicial em R$
  vendas: [],
  farmes: [],
  config: { ...CONFIG },
  painelCanalId: null,
  painelMensagemId: null
};

// Carregar dados salvos
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

// INICIALIZANDO CLIENT DO DISCORD
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ATUALIZAR PARCELAS DE ESTOQUE
function recalcularEstoqueDividido() {
  const pctKits = db.config.PERCENT_STEEL_FOR_KITS || 60;
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

// OBTER ACUMULADO DE AÇO DE UM MEMBRO (FARMES)
function obterAcoTotalMembro(userId) {
  let total = 0;
  if (db.farmes) {
    db.farmes.forEach(f => {
      if (f.userId === userId) total += f.quantidade;
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
        .setDescription(`🏆 **Excelente trabalho na facção!**\n\n👤 **Membro:** <@${userId}> (${userName})\n⛓️ **Aço Acumulado:** **${formatarNumero(totalAcoNovo)} kg** / ${formatarNumero(meta)} kg\n\nO membro bateu a meta semanal de aço e garantiu o direito de retirar o seu **Kit de Meta**! Foco total! 🐺`)
        .setFooter({ text: 'Hunters ERP • Sorte aos Fortes' })
        .setTimestamp();

      await canalAvisos.send({
        content: `🚨 **META BATIDA!** <@${userId}> superou o objetivo semanal de aço! Parabéns! ⚔️`,
        embeds: [embedMeta]
      }).catch(() => null);
    }
  }
}

// GERAR O PAYLOAD VISUAL DO PAINEL OPERACIONAL
function obterPainelPayload() {
  const kitsProntos = Math.floor(db.estoqueKits / db.config.CUSTO_KIT_KG);

  const embed = new EmbedBuilder()
    .setTitle('🐺 HUNTERS ERP • PAINEL OPERACIONAL')
    .setColor('#a855f7')
    .setDescription(
      `Bem-vindo à central de inteligência e logística do clã **Hunters**. Aqui você pode atualizar o estoque do baú, registrar seus farmes individuais de aço e lançar vendas de armas com divisão automática de lucros.\n\n` +
      `📊 **ESTADO ATUAL DO ESTOQUE**\n` +
      `⛓️ **Estoque Geral:** **${formatarNumero(db.estoque)} kg** de aço\n` +
      `└─ 🎁 Reservado p/ Kits (${db.config.PERCENT_STEEL_FOR_KITS}%): **${formatarNumero(db.estoqueKits)} kg**\n` +
      `└─ 🔫 Reservado p/ Vendas (${db.config.PERCENT_STEEL_FOR_SALES}%): **${formatarNumero(db.estoqueVendas)} kg**\n\n` +
      `🎁 **SITUAÇÃO DE KITS DA META**\n` +
      `📦 **Kits Prontos p/ Retirada:** **${formatarNumero(kitsProntos)}** kits *(Custo: ${formatarNumero(db.config.CUSTO_KIT_KG)} kg/kit)*\n\n` +
      `🏦 **RECURSOS DO CLÃ**\n` +
      `💰 **Caixa Líquido do Clã:** **${formatarMoeda(db.caixa)}**\n` +
      `💸 **Divisão de Vendas:** **${100 - db.config.SPLIT_CLAN_PERCENT}%** Clã | **${db.config.SPLIT_CLAN_PERCENT}%** Comissão Membro\n\n` +
      `⏱️ *Última sincronização em tempo real: <t:${Math.floor(Date.now() / 1000)}:R>*`
    )
    .setFooter({ text: 'Hunters ERP • Clique nos botões abaixo para abrir os formulários' })
    .setTimestamp();

  // Linha de Botões 1: Consultas e Registro de Farme
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_consultar_estoque')
      .setLabel('📦 Consultar Estoque')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_consultar_caixa')
      .setLabel('🏦 Consultar Caixa')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_registrar_farme')
      .setLabel('🎯 Registrar Farme')
      .setStyle(ButtonStyle.Success)
  );

  // Linha de Botões 2: Financeiro e Estoque Manual
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_registrar_venda')
      .setLabel('💰 Registrar Venda')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_add_aco')
      .setLabel('➕ Adicionar Aço')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_retirar_aco')
      .setLabel('➖ Retirar Aço')
      .setStyle(ButtonStyle.Danger)
  );

  // Linha de Botões 3: Estatísticas e Info
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_ver_ranking')
      .setLabel('🏆 Ranking de Vendedores')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_ver_detalhes_kit')
      .setLabel('🎁 Detalhes do Kit')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

// ATUALIZAR A MENSAGEM DO PAINEL EXISTENTE
async function atualizarPainel(guild) {
  if (!db.painelCanalId || !db.painelMensagemId) return;

  try {
    const canal = guild.channels.cache.get(db.painelCanalId) 
      || await guild.channels.fetch(db.painelCanalId).catch(() => null);

    if (canal) {
      const msg = await canal.messages.fetch(db.painelMensagemId).catch(() => null);
      if (msg) {
        await msg.edit(obterPainelPayload()).catch(() => null);
        console.log('✅ [HUNTERS] Painel central atualizado com sucesso!');
      }
    }
  } catch (err) {
    console.error('❌ [HUNTERS] Erro ao editar mensagem do painel:', err.message);
  }
}

// QUANDO O BOT ENTRAR EM ATIVIDADE
client.once('ready', () => {
  carregarBanco();
  recalcularEstoqueDividido();
  salvarBanco();

  console.log(`🤖 [HUNTERS] Bot conectado como ${client.user.tag}!`);

  client.user.setPresence({
    activities: [{ name: 'Hunters ERP • Sorte aos Fortes ⚔️', type: ActivityType.Playing }],
    status: 'online'
  });
});

// LISTENER DE COMANDOS DE MENSAGEM (PREFIXO)
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(db.config.PREFIX)) return;

  const args = message.content.slice(db.config.PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // COMANDO: !avisometa (DISPARAR AVISO OFICIAL DE META)
  if (command === 'avisometa' || command === 'geraraviso' || command === 'aviso') {
    if (!message.member.permissions.has('Administrator')) {
      return message.reply('❌ **Acesso Negado!** Apenas administradores do clã podem disparar este aviso oficial.');
    }

    const canalAvisosId = db.config.CANAL_AVISOS_ID || '1515125864033943712';
    const cargoNotificarId = db.config.CARGO_NOTIFICAR_ID || '1515125826780135485';

    let canalAvisos = client.channels.cache.get(canalAvisosId);
    if (!canalAvisos) {
      try {
        canalAvisos = await client.channels.fetch(canalAvisosId);
      } catch (e) {
        return message.reply(`❌ **Erro:** Não consegui localizar o canal de avisos com o ID \`${canalAvisosId}\`. Verifique as permissões de leitura/escrita do bot.`);
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
        `Você deve registrar seus farmes clicando no botão **Registrar Farme** do nosso painel no canal oficial:\n` +
        `👉 **Clique aqui para ir ao Canal do Painel:** <#${db.config.CANAL_PAINEL_ID || '1523844178151473193'}>\n` +
        `*(Membros que não preencherem estarão sujeitos à remoção das permissões de kits)*\n\n` +
        `Não perca o prazo e garanta o seu kit semanal regulamentar de armamentos! Foco total na meta! ⚔️`)
      .setFooter({ text: 'Hunters ERP • Administração Hunters' })
      .setTimestamp();

    try {
      await canalAvisos.send({
        content: `🚨 **ATENÇÃO** <@&${cargoNotificarId}>! 🚨\n**AVISO IMPORTANTÍSSIMO SOBRE A META DE AÇO DOS KITS!**`,
        embeds: [embedAviso]
      });
      return message.reply(`✅ **Aviso enviado com sucesso!** A mensagem foi publicada em <#${canalAvisosId}>.`);
    } catch (err) {
      console.error('Erro ao enviar mensagem de aviso de meta:', err);
      return message.reply(`❌ **Erro ao enviar aviso:** \`${err.message}\`. Certifique-se de que o bot possui permissão no canal.`);
    }
  }

  // COMANDO: !painel (GERAR O PAINEL DE CONTROLE CENTRAL)
  if (command === 'painel' || command === 'central' || command === 'ajuda' || command === 'help') {
    // Apagar painel antigo do canal anterior se houver
    if (db.painelCanalId && db.painelMensagemId) {
      try {
        const canalAntigo = client.channels.cache.get(db.painelCanalId) 
          || await client.channels.fetch(db.painelCanalId).catch(() => null);
        if (canalAntigo) {
          const msgAntiga = await canalAntigo.messages.fetch(db.painelMensagemId).catch(() => null);
          if (msgAntiga) {
            await msgAntiga.delete().catch(() => null);
          }
        }
      } catch (e) {
        console.log('Não foi possível deletar o painel anterior:', e.message);
      }
    }

    // Criar novo painel no canal atual
    try {
      const payload = obterPainelPayload();
      const novaMsg = await message.channel.send(payload);
      
      db.painelCanalId = message.channel.id;
      db.painelMensagemId = novaMsg.id;
      db.config.CANAL_PAINEL_ID = message.channel.id;
      salvarBanco();

      const confMsg = await message.reply('✅ **Painel Central Operacional criado e ativo neste canal!** Todos os botões estão ativos para a facção.');
      setTimeout(() => confMsg.delete().catch(() => null), 6000);
      await message.delete().catch(() => null);
    } catch (err) {
      console.error('Erro ao criar painel central:', err);
      return message.reply(`❌ **Erro ao gerar painel:** ${err.message}`);
    }
  }

  // COMANDO: !resetciclo (ZERAR HISTÓRICOS DE ACUMULADOS PARA NOVA META)
  if (command === 'resetciclo' || command === 'limparhistorico') {
    if (!message.member.permissions.has('Administrator')) {
      return message.reply('❌ **Acesso Negado!** Apenas administradores do clã podem resetar o ciclo atual.');
    }

    db.farmes = [];
    db.vendas = [];
    db.estoque = 150000;
    db.caixa = 15000000;
    recalcularEstoqueDividido();
    salvarBanco();

    await atualizarPainel(message.guild);
    return message.reply('✅ **Sucesso!** O ciclo semanal foi encerrado. Todos os históricos de vendas e farmes de aço foram zerados para a nova meta.');
  }

  // COMANDO: !status (STATUS RAPIDO)
  if (command === 'status' || command === 'logistica') {
    const kitsProntos = Math.floor(db.estoqueKits / db.config.CUSTO_KIT_KG);
    const embedStatus = new EmbedBuilder()
      .setTitle('📊 ESTADO GERAL DE RECURSOS - HUNTERS')
      .setColor('#a855f7')
      .addFields(
        { name: '⛓️ Estoque Total', value: `${formatarNumero(db.estoque)} kg`, inline: true },
        { name: '🎁 Reservado p/ Kits', value: `${formatarNumero(db.estoqueKits)} kg`, inline: true },
        { name: '🔫 Reservado p/ Vendas', value: `${formatarNumero(db.estoqueVendas)} kg`, inline: true },
        { name: '📦 Kits Prontos', value: `${formatarNumero(kitsProntos)} un.`, inline: true },
        { name: '🏦 Caixa Líquido', value: `${formatarMoeda(db.caixa)}`, inline: true }
      )
      .setTimestamp();
    return message.reply({ embeds: [embedStatus] });
  }
});

// LISTENER DE INTERAÇÕES (CLIQUES EM BOTÕES E SUBMISSÕES DE FORMULÁRIOS)
client.on('interactionCreate', async (interaction) => {
  const guild = interaction.guild;
  if (!guild) return;

  // 1. MANIPULAR CLIQUES DOS BOTÕES DO PAINEL
  if (interaction.isButton()) {
    const customId = interaction.customId;

    // BOTÃO: CONSULTAR ESTOQUE (Resposta rápida)
    if (customId === 'btn_consultar_estoque') {
      const kitsProntos = Math.floor(db.estoqueKits / db.config.CUSTO_KIT_KG);
      const embedEstoque = new EmbedBuilder()
        .setTitle('📦 CONSULTA DE ESTOQUE DETALHADA')
        .setColor('#5865f2')
        .setDescription(
          `Aqui está o detalhamento de materiais da facção:\n\n` +
          `⛓️ **Aço no Baú:** \`${formatarNumero(db.estoque)} kg\`\n` +
          `├─ 🎁 **Aço p/ Kits (${db.config.PERCENT_STEEL_FOR_KITS}%):** \`${formatarNumero(db.estoqueKits)} kg\`\n` +
          `└─ 🔫 **Aço p/ Vendas (${db.config.PERCENT_STEEL_FOR_SALES}%):** \`${formatarNumero(db.estoqueVendas)} kg\`\n\n` +
          `📦 **Kits Prontos p/ Retirada:** \`${kitsProntos} unidades\` *(Custo de ${formatarNumero(db.config.CUSTO_KIT_KG)} kg de aço cada)*`
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embedEstoque], ephemeral: true });
    }

    // BOTÃO: CONSULTAR CAIXA (Resposta rápida)
    if (customId === 'btn_consultar_caixa') {
      const totalFaturado = db.vendas.reduce((acc, v) => acc + v.total, 0);
      const totalComissao = db.vendas.reduce((acc, v) => acc + v.comissao, 0);

      const embedCaixa = new EmbedBuilder()
        .setTitle('🏦 STATUS DO COFRE E CAIXA')
        .setColor('#5865f2')
        .setDescription(
          `Abaixo está o balanço financeiro atualizado:\n\n` +
          `💰 **Recurso Líquido no Cofre:** **${formatarMoeda(db.caixa)}**\n` +
          `📈 **Bruto Comercializado:** \`${formatarMoeda(totalFaturado)}\`\n` +
          `💸 **Total pago em Comissões:** \`${formatarMoeda(totalComissao)}\`\n\n` +
          `💼 *Divisão de Vendas: ${100 - db.config.SPLIT_CLAN_PERCENT}% Clã | ${db.config.SPLIT_CLAN_PERCENT}% Comissão do Vendedor*`
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embedCaixa], ephemeral: true });
    }

    // BOTÃO: DETALHES DO KIT
    if (customId === 'btn_ver_detalhes_kit') {
      const embedDetalhes = new EmbedBuilder()
        .setTitle('🎁 COMPOSIÇÃO DO KIT DE META SEMANAL')
        .setColor('#a855f7')
        .setDescription(
          `Para receber este kit completo, o membro deve atingir o farme acumulado de **${formatarNumero(db.config.META_ACO_KG)} kg de aço** na semana.\n\n` +
          `⚖️ **Custo Unitário de Aço:** \`${formatarNumero(db.config.CUSTO_KIT_KG)} kg\`\n\n` +
          `📦 **Componentes inclusos no Kit:**\n` +
          `• **1x Fuzil AK-47** *(Equivalente a ${formatarNumero(KIT_META_ITENS.ak47.aco)} kg)*\n` +
          `• **5x Coletes Táticos** *(Equivalente a ${formatarNumero(KIT_META_ITENS.coletes.aco)} kg)*\n` +
          `• **250x Munições de Fuzil** *(Equivalente a ${formatarNumero(KIT_META_ITENS.municao.aco)} kg)*\n\n` +
          `*Registre seus farmes no painel! Foco total na meta.*`
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embedDetalhes], ephemeral: true });
    }

    // BOTÃO: VER RANKING DE VENDEDORES
    if (customId === 'btn_ver_ranking') {
      if (!db.vendas || db.vendas.length === 0) {
        return interaction.reply({ content: '❌ Nenhuma venda foi registrada até o momento neste ciclo.', ephemeral: true });
      }

      const rankingMap = {};
      db.vendas.forEach(v => {
        if (!rankingMap[v.userName]) rankingMap[v.userName] = { total: 0, count: 0 };
        rankingMap[v.userName].total += v.total;
        rankingMap[v.userName].count += v.quantidade;
      });

      const sorted = Object.entries(rankingMap)
        .map(([name, stat]) => ({ name, ...stat }))
        .sort((a, b) => b.total - a.total);

      let txt = '';
      sorted.forEach((user, idx) => {
        const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
        txt += `${medal} **${user.name}** - Faturou: **${formatarMoeda(user.total)}** (${user.count} armas)\n`;
      });

      const embedRanking = new EmbedBuilder()
        .setTitle('🏆 RANKING DE VENDEDORES - HUNTERS')
        .setColor('#f59e0b')
        .setDescription(txt)
        .setTimestamp();
      return interaction.reply({ embeds: [embedRanking], ephemeral: true });
    }

    // BOTÃO COM MODAL: REGISTRAR FARME
    if (customId === 'btn_registrar_farme') {
      const modal = new ModalBuilder()
        .setCustomId('md_registrar_farme')
        .setTitle('🎯 Registrar Farme de Aço');

      const qtyInput = new TextInputBuilder()
        .setCustomId('farme_qty')
        .setLabel('Quantidade de Aço extraída (em kg):')
        .setPlaceholder('Ex: 2500')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));
      return interaction.showModal(modal);
    }

    // BOTÃO COM MODAL: REGISTRAR VENDA
    if (customId === 'btn_registrar_venda') {
      const modal = new ModalBuilder()
        .setCustomId('md_registrar_venda')
        .setTitle('💰 Registrar Venda de Armas');

      const weaponInput = new TextInputBuilder()
        .setCustomId('venda_weapon')
        .setLabel('Cód da Arma (ak47, m4a1, g36, smg, glock):')
        .setPlaceholder('Ex: ak47')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const qtyInput = new TextInputBuilder()
        .setCustomId('venda_qty')
        .setLabel('Quantidade vendida:')
        .setPlaceholder('Ex: 1')
        .setStyle(TextInputStyle.Short)
        .setValue('1')
        .setRequired(true);

      const discountInput = new TextInputBuilder()
        .setCustomId('venda_discount')
        .setLabel('Desconto concedido (em % de 0 a 100):')
        .setPlaceholder('Ex: 0')
        .setStyle(TextInputStyle.Short)
        .setValue('0')
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(weaponInput),
        new ActionRowBuilder().addComponents(qtyInput),
        new ActionRowBuilder().addComponents(discountInput)
      );
      return interaction.showModal(modal);
    }

    // BOTÃO COM MODAL: ADICIONAR AÇO (ADMINISTRATIVO)
    if (customId === 'btn_add_aco') {
      const modal = new ModalBuilder()
        .setCustomId('md_add_aco')
        .setTitle('➕ Adicionar Aço ao Baú');

      const qtyInput = new TextInputBuilder()
        .setCustomId('add_qty')
        .setLabel('Quantidade para adicionar (kg):')
        .setPlaceholder('Ex: 5000')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));
      return interaction.showModal(modal);
    }

    // BOTÃO COM MODAL: RETIRAR AÇO (ADMINISTRATIVO)
    if (customId === 'btn_retirar_aco') {
      const modal = new ModalBuilder()
        .setCustomId('md_sub_aco')
        .setTitle('➖ Retirar Aço do Baú');

      const qtyInput = new TextInputBuilder()
        .setCustomId('sub_qty')
        .setLabel('Quantidade para retirar (kg):')
        .setPlaceholder('Ex: 4000')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));
      return interaction.showModal(modal);
    }
  }

  // 2. TRATAMENTO DE ENVIO DOS FORMULÁRIOS (MODAIS)
  if (interaction.type === InteractionType.ModalSubmit) {
    const customId = interaction.customId;
    const member = interaction.member;
    const user = interaction.user;

    // ENVIO MODAL: REGISTRAR FARME
    if (customId === 'md_registrar_farme') {
      const qtyStr = interaction.fields.getTextInputValue('farme_qty');
      const qty = parseInt(qtyStr);

      if (isNaN(qty) || qty <= 0) {
        return interaction.reply({ content: '❌ **Erro:** Quantidade de aço informada inválida. Digite um número positivo.', ephemeral: true });
      }

      const totalAnterior = obterAcoTotalMembro(user.id);

      db.estoque += qty;
      recalcularEstoqueDividido();

      const novoFarme = {
        id: `farme-${Date.now()}`,
        userId: user.id,
        userName: member.displayName || user.username,
        quantidade: qty,
        data: new Date().toISOString()
      };
      db.farmes.push(novoFarme);
      salvarBanco();

      const totalNovo = obterAcoTotalMembro(user.id);
      await verificarMetaAtingida(user.id, member.displayName || user.username, totalAnterior, totalNovo, guild);

      await interaction.reply({
        content: `✅ **Farme Registrado!** Você registrou **${formatarNumero(qty)} kg** de aço com sucesso.\nAcumulado semanal: **${formatarNumero(totalNovo)} kg** / ${formatarNumero(db.config.META_ACO_KG)} kg de aço.`,
        ephemeral: true
      });

      await atualizarPainel(guild);
      return;
    }

    // ENVIO MODAL: REGISTRAR VENDA
    if (customId === 'md_registrar_venda') {
      const weaponKey = interaction.fields.getTextInputValue('venda_weapon').trim().toLowerCase();
      const qtyStr = interaction.fields.getTextInputValue('venda_qty');
      const discountStr = interaction.fields.getTextInputValue('venda_discount') || '0';

      const qty = parseInt(qtyStr);
      const discount = parseInt(discountStr);

      const arma = ARMAS[weaponKey];
      if (!arma) {
        return interaction.reply({
          content: '❌ **Erro:** Arma inválida! Opções: `ak47`, `m4a1`, `g36`, `smg`, `glock`, `five_seven`, `tec9`, `hk45`.',
          ephemeral: true
        });
      }

      if (isNaN(qty) || qty <= 0) {
        return interaction.reply({ content: '❌ **Erro:** Quantidade de armas inválida.', ephemeral: true });
      }

      if (isNaN(discount) || discount < 0 || discount > 100) {
        return interaction.reply({ content: '❌ **Erro:** Desconto deve ser uma porcentagem entre 0% e 100%.', ephemeral: true });
      }

      const totalAcoConsumido = arma.aco * qty;

      if (db.estoqueVendas < totalAcoConsumido) {
        return interaction.reply({
          content: `❌ **Erro de Estoque!** Não há aço de vendas suficiente no baú. Necessário: **${formatarNumero(totalAcoConsumido)} kg** | Disponível para vendas: **${formatarNumero(db.estoqueVendas)} kg**.`,
          ephemeral: true
        });
      }

      const precoBruto = arma.preco * qty;
      const valorDesconto = (precoBruto * discount) / 100;
      const precoLiquido = precoBruto - valorDesconto;

      const pctMembro = db.config.SPLIT_CLAN_PERCENT || 50;
      const comissaoMembro = (precoLiquido * pctMembro) / 100;
      const liquidoClan = precoLiquido - comissaoMembro;

      db.estoque -= totalAcoConsumido;
      db.caixa += liquidoClan;
      recalcularEstoqueDividido();

      const novaVenda = {
        id: `venda-${Date.now()}`,
        userId: user.id,
        userName: member.displayName || user.username,
        armaKey: weaponKey,
        armaNome: arma.nome,
        quantidade: qty,
        precoUnitario: arma.preco,
        total: precoLiquido,
        comissao: comissaoMembro,
        acoConsumido: totalAcoConsumido,
        data: new Date().toISOString()
      };
      db.vendas.push(novaVenda);
      salvarBanco();

      await interaction.reply({
        content: `✅ **Venda Registrada com Sucesso!**\n` +
          `🔫 **Arma:** ${arma.nome} (x${qty})\n` +
          `⛓️ **Aço de Vendas Consumido:** \`${formatarNumero(totalAcoConsumido)} kg\`\n` +
          `💵 **Valor Total Líquido:** \`${formatarMoeda(precoLiquido)}\` (Desconto: ${discount}%)\n` +
          `🏦 **Cofre do Clã:** +\`${formatarMoeda(liquidoClan)}\`\n` +
          `💸 **Sua Comissão:** +\`${formatarMoeda(comissaoMembro)}\``,
        ephemeral: true
      });

      // Publicar recibo da venda no canal do painel para auditoria
      const canalPainel = guild.channels.cache.get(db.painelCanalId);
      if (canalPainel) {
        const embedVendaLog = new EmbedBuilder()
          .setTitle('💰 NOVA VENDA REGISTRADA • LOGS')
          .setColor('#10b981')
          .setDescription(
            `👤 **Vendedor:** <@${user.id}> (${member.displayName || user.username})\n` +
            `🔫 **Modelo:** ${arma.nome} (x${qty})\n` +
            `⛓️ **Consumo de Material:** \`${formatarNumero(totalAcoConsumido)} kg\` de aço faturados\n\n` +
            `💵 **Balanço Financeiro:**\n` +
            `├─ **Faturamento Líquido:** \`${formatarMoeda(precoLiquido)}\`\n` +
            `├─ **Cofre Hunters:** \`${formatarMoeda(liquidoClan)}\`\n` +
            `└─ **Comissão paga:** \`${formatarMoeda(comissaoMembro)}\` (Split: ${pctMembro}%)`
          )
          .setFooter({ text: 'Hunters ERP • Logs Comerciais' })
          .setTimestamp();
        
        await canalPainel.send({ embeds: [embedVendaLog] }).catch(() => null);
      }

      await atualizarPainel(guild);
      return;
    }

    // ENVIO MODAL: ADICIONAR AÇO (ADMINISTRATIVO)
    if (customId === 'md_add_aco') {
      const qtyStr = interaction.fields.getTextInputValue('add_qty');
      const qty = parseInt(qtyStr);

      if (isNaN(qty) || qty <= 0) {
        return interaction.reply({ content: '❌ **Erro:** Digite um número positivo válido.', ephemeral: true });
      }

      db.estoque += qty;
      recalcularEstoqueDividido();
      salvarBanco();

      await interaction.reply({ content: `✅ **Sucesso!** Adicionado **${formatarNumero(qty)} kg** de aço ao baú geral da facção.`, ephemeral: true });
      await atualizarPainel(guild);
      return;
    }

    // ENVIO MODAL: RETIRAR AÇO (ADMINISTRATIVO)
    if (customId === 'md_sub_aco') {
      const qtyStr = interaction.fields.getTextInputValue('sub_qty');
      const qty = parseInt(qtyStr);

      if (isNaN(qty) || qty <= 0) {
        return interaction.reply({ content: '❌ **Erro:** Digite um número positivo válido.', ephemeral: true });
      }

      if (db.estoque < qty) {
        return interaction.reply({ content: `❌ **Erro:** Saldo de aço insuficiente no baú. Estoque atual: **${formatarNumero(db.estoque)} kg**.`, ephemeral: true });
      }

      db.estoque -= qty;
      recalcularEstoqueDividido();
      salvarBanco();

      await interaction.reply({ content: `✅ **Sucesso!** Retirado **${formatarNumero(qty)} kg** de aço do baú geral da facção.`, ephemeral: true });
      await atualizarPainel(guild);
      return;
    }
  }
});

// LOGIN DO CLIENT
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error("❌ Erro fatal ao iniciar o cliente Discord. Verifique se o DISCORD_TOKEN informado no arquivo .env está correto:", err.message);
});
