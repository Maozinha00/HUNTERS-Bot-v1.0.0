/**
 * 🐺 HUNTERS ERP - DISCORD BOT CENTRALIZADO (v4.0)
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
 *   3. Inicie o bot executando: node bot.js
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

// CONFIGURAÇÕES GERAIS DO CLÃ (Configure com seus IDs)
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
  // ARMAS
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

  // CAIXAS DE MUNIÇÃO
  box_m_pistola: { nome: "Box Pistola", preco: 2000, aco: 40 },
  box_m_sub: { nome: "Box Submetralhadora", preco: 3000, aco: 80 },
  box_m_escopeta: { nome: "Box Escopeta", preco: 4000, aco: 100 },
  box_m_556: { nome: "Box 5.56", preco: 5000, aco: 120 },
  box_m_308: { nome: "Box .308", preco: 5000, aco: 200 },

  // MUNIÇÕES (CAIXA COM 10)
  municao_pistola_10x: { nome: "Munição Pistola (10x)", preco: 2000, aco: 40 },
  municao_smg_10x: { nome: "Munição SMG (10x)", preco: 3000, aco: 80 },
  municao_escopeta_10x: { nome: "Munição Escopeta (10x)", preco: 4000, aco: 100 },
  municao_fuzil_10x: { nome: "Munição Fuzil (5.56 / .308) (10x)", preco: 5000, aco: 120 }
};

// COMPONENTES DOS KITS DA META
const KIT_META_ITENS = {
  ak47: { nome: "1x AK-47", aco: 1000, quantidade: 1 },
  coletes: { nome: "5x Coletes Táticos", aco: 1500, quantidade: 5 },
  municao: { nome: "250x Munições de Fuzil", aco: 760, quantidade: 250 }
};

// INICIALIZAÇÃO DO BANCO DE DADOS LOCAL ( hunters-db.json )
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

// INICIALIZANDO CLIENT DO DISCORD
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// FUNÇÃO PARA ATUALIZAR PARCELAS DE ESTOQUE
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

// OBTER ACUMULADO DE AÇO (FARMES + VENDAS DE UM MEMBRO)
function obterAcoTotalMembro(userId) {
  let total = 0;
  
  // Somar farmes
  if (db.farmes) {
    db.farmes.forEach(f => {
      if (f.userId === userId) total += f.quantidade;
    });
  }
  
  // Somar aço consumido nas vendas
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

  const embed = new EmbedBuilder()
    .setTitle('🐺 HUNTERS LOGÍSTICA & CONTROLE CENTRAL')
    .setColor('#a855f7')
    .setThumbnail('https://i.imgur.com/Kivb8yK.png')
    .setDescription('Bem-vindo ao centro logístico operacional dos Hunters. Utilize os botões interativos abaixo para registrar atividades, gerenciar o estoque tático e consultar o arsenal.')
    .addFields(
      { 
        name: '📦 Kits de Meta Disponíveis', 
        value: `\`${kitsDisponiveis} Kits\` (${formatarNumero(db.estoqueKits)} kg no total)`, 
        inline: true 
      },
      { 
        name: '🛠️ Aço em Estoque', 
        value: `\`${formatarNumero(db.estoque)} kg\``, 
        inline: true 
      }
    )
    .setFooter({ text: 'Hunters ERP • Integrado ao Sistema' })
    .setTimestamp();

  // Linha de Botões 1: Ações Principais
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_registrar_farme')
      .setLabel('📦🌾 Registrar Farme')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_registrar_venda')
      .setLabel('🤝💰 Registrar Venda')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_consultar_estoque')
      .setLabel('📊🔍 Consultar Estoque')
      .setStyle(ButtonStyle.Secondary)
  );

  // Linha de Botões 2: Gerenciamento Manual de Estoque
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_add_aco')
      .setLabel('➕ Adicionar Aço')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_retirar_aco')
      .setLabel('➖ Remover Aço')
      .setStyle(ButtonStyle.Danger)
  );

  // Linha de Botões 3: Consultas Extras & Staff
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_consultar_caixa')
      .setLabel('🏦 Consultar Caixa')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_ver_ranking')
      .setLabel('🏆 Ver Ranking de Vendedores')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_ver_detalhes_kit')
      .setLabel('🎁 Detalhes do Kit')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_staff_reset')
      .setLabel('⚙️ Resetar Ciclo')
      .setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

// FUNÇÃO PARA ATUALIZAR A MENSAGEM DO PAINEL SE EXISTIR
async function atualizarPainel(guild) {
  if (db.painelCanalId && db.painelMensagemId) {
    try {
      const canal = guild.channels.cache.get(db.painelCanalId) 
        || await guild.channels.fetch(db.painelCanalId).catch(() => null);
      if (canal) {
        const msg = await canal.messages.fetch(db.painelMensagemId).catch(() => null);
        if (msg) {
          await msg.edit(obterPainelPayload()).catch(() => null);
        }
      }
    } catch (e) {
      console.log('Não foi possível atualizar o painel central:', e.message);
    }
  }
}

// EVENTO: QUANDO O BOT FICA ONLINE
client.once('ready', () => {
  console.log(`🤖 [HUNTERS] Bot iniciado com sucesso como: ${client.user.tag}`);
  
  // Setar presença/status do bot
  client.user.setActivity({
    name: 'Logística dos Hunters 🐺',
    type: ActivityType.Watching
  });

  carregarBanco();
  recalcularEstoqueDividido();
  salvarBanco();
});

// EVENTO: QUANDO CHEGA UMA MENSAGEM (Comandos via Prefixo)
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const prefix = db.config.PREFIX || CONFIG.PREFIX;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // COMANDO: FORÇAR DISPARO DE AVISO DE META NO DISCORD
  if (command === 'avisometa' || command === 'avisar') {
    const cargoNotificarId = db.config.CARGO_NOTIFICAR_ID || '1515125826780135485';
    const canalAvisosId = db.config.CANAL_AVISOS_ID || '1515125864033943712';

    if (!message.member.permissions.has('Administrator')) {
      return message.reply('❌ **Acesso Negado!** Apenas administradores do clã podem disparar este aviso.');
    }

    const canalAvisos = message.guild.channels.cache.get(canalAvisosId) 
      || await message.guild.channels.fetch(canalAvisosId).catch(() => null);

    if (!canalAvisos) {
      return message.reply(`❌ **Erro:** Canal de avisos (<#${canalAvisosId}>) não encontrado. Verifique as configurações.`);
    }

    try {
      const embedAviso = new EmbedBuilder()
        .setTitle('🚨 DIRETRIZES DA META SEMANAL - HUNTERS 🚨')
        .setColor('#a855f7')
        .setThumbnail('https://i.imgur.com/Kivb8yK.png')
        .setDescription(
          `⚔️ **Atenção Clã Hunters! Novo ciclo operacional ativo!** ⚔️\n\n` +
          `A meta individual para este ciclo está estipulada em **${formatarNumero(db.config.META_ACO_KG)} kg de aço** depositados no baú.\n\n` +
          `🎁 **Recompensa ao cumprir a meta:**\n` +
          `• **1x Rifle AK-47**\n` +
          `• **5x Coletes Táticos**\n` +
          `• **250x Munições de Fuzil**\n\n` +
          `Utilizem o canal <#${db.config.CANAL_PAINEL_ID || message.channel.id}> para registrar sua produção clicando no botão **Registrar Farme**.\n\n` +
          `*Qualquer dúvida ou problema, procurem a liderança ou a Staff. Força e honra!*`
        )
        .setFooter({ text: 'Hunters ERP • Controle de Metas' })
        .setTimestamp();

      await canalAvisos.send({
        content: `📢 <@&${cargoNotificarId}> **DIRETRIZES DA META SEMANAL ATUALIZADAS! FOCO NO ARSENAL!** 📢`,
        embeds: [embedAviso]
      });
      return message.reply(`✅ **Aviso enviado com sucesso!** A mensagem com as diretrizes e marcação foi enviada no canal de avisos <#${canalAvisosId}>.`);
    } catch (err) {
      console.error('Erro ao enviar mensagem de aviso de meta:', err);
      return message.reply(`❌ **Erro ao enviar aviso:** \`${err.message}\`. Certifique-se de que o bot possui permissão de enviar mensagens e embeds no canal <#${canalAvisosId}>.`);
    }
  }

  // COMANDO: GERAR PAINEL CENTRAL (Sempre apaga o antigo para evitar duplicatas e recria no canal atual)
  if (command === 'painel' || command === 'central' || command === 'ajuda' || command === 'help') {
    // Apagar painel antigo se houver
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

    // Criar novo painel no canal onde o comando foi disparado
    try {
      const payload = obterPainelPayload();
      const novaMsg = await message.channel.send(payload);
      
      db.painelCanalId = message.channel.id;
      db.painelMensagemId = novaMsg.id;
      db.config.CANAL_PAINEL_ID = message.channel.id;
      salvarBanco();

      const confMsg = await message.reply('✅ **Painel Central Operacional criado e fixado com sucesso neste canal!** Todos os botões estão ativos para a facção.');
      setTimeout(() => confMsg.delete().catch(() => null), 6000);
      await message.delete().catch(() => null);
    } catch (err) {
      console.error('Erro ao criar painel central:', err);
      return message.reply(`❌ **Erro ao gerar painel:** ${err.message}`);
    }
  }

  // COMANDO: RESET GERAL DO CICLO (Apenas Administradores)
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

  // COMANDO: ESTADO GERAL RÁPIDO
  if (command === 'status' || command === 'logistica') {
    const cargoNotificarId = db.config.CARGO_NOTIFICAR_ID || '1515125826780135485';
    const hasRole = message.member.roles.cache.has(cargoNotificarId) || 
                    message.member.roles.cache.some(r => ['Líder', 'Vendedor Elite', 'Farmador Pro', 'Staff'].includes(r.name)) || 
                    message.member.permissions.has('Administrator');
    if (!hasRole) {
      return message.reply(`❌ **Acesso Negado!** Você precisa ter o cargo <@&${cargoNotificarId}> para consultar o estoque.`);
    }

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

// LISTENER DE BOTÕES E SUBMISSÃO DE MODAIS (INTERACTION CREATE)
client.on('interactionCreate', async (interaction) => {
  const guild = interaction.guild;
  if (!guild) return;

  // 1. MANIPULAÇÃO DE BOTÕES (Gera os Modais do Discord correspondentes)
  if (interaction.isButton()) {
    const customId = interaction.customId;

    // BOTÃO: CONSULTAR ESTOQUE (Sem Modal, resposta imediata)
    if (customId === 'btn_consultar_estoque') {
      const cargoNotificarId = db.config.CARGO_NOTIFICAR_ID || '1515125826780135485';
      const hasRole = interaction.member.roles.cache.has(cargoNotificarId) || 
                      interaction.member.roles.cache.some(r => ['Líder', 'Vendedor Elite', 'Farmador Pro', 'Staff'].includes(r.name)) || 
                      interaction.member.permissions.has('Administrator');
      if (!hasRole) {
        return interaction.reply({
          content: `❌ **Acesso Negado!** Você precisa ter o cargo <@&${cargoNotificarId}> para consultar o estoque tático.`,
          ephemeral: true
        });
      }

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

    // BOTÃO: CONSULTAR CAIXA (Sem Modal, resposta imediata)
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

    // BOTÃO: DETALHES DO KIT (Sem Modal)
    if (customId === 'btn_ver_detalhes_kit') {
      const embedDetalhes = new EmbedBuilder()
        .setTitle('🎁 COMPOSIÇÃO DO KIT DE META SEMANAL')
        .setColor('#a855f7')
        .setDescription(
          `Para receber este kit completo, o membro deve atingir o farme acumulado de **${formatarNumero(db.config.META_ACO_KG)} kg de aço** na semana.\n\n` +
          `📦 **Componentes inclusos no Kit:**\n` +
          `• **1x Fuzil AK-47**\n` +
          `• **5x Coletes Táticos**\n` +
          `• **250x Munições de Fuzil**\n\n` +
          `*Registre seus farmes no painel! Foco na produção do arsenal.*`
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embedDetalhes], ephemeral: true });
    }

    // BOTÃO: VER RANKING DE VENDEDORES (Sem Modal)
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

    // BOTÃO: RESETAR CICLO (Staff only, check for administrator permission)
    if (customId === 'btn_staff_reset') {
      if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ content: '❌ **Acesso Negado!** Apenas administradores/staff podem resetar o ciclo atual.', ephemeral: true });
      }

      db.farmes = [];
      db.vendas = [];
      db.estoque = 150000;
      db.caixa = 15000000;
      recalcularEstoqueDividido();
      salvarBanco();

      await atualizarPainel(guild);
      return interaction.reply({ content: '✅ **Sucesso!** O ciclo semanal e histórico foram resetados com sucesso.', ephemeral: true });
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
        .setLabel('Cod. da Arma (ak47, m4a1, g36, smg, glock):')
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

  // 2. TRATAMENTO DOS ENVIOS DE MODAIS (SUBMIT)
  if (interaction.type === InteractionType.ModalSubmit) {
    const customId = interaction.customId;
    const member = interaction.member;
    const user = interaction.user;

    // SUBMIT MODAL: REGISTRAR FARME
    if (customId === 'md_registrar_farme') {
      const qtyStr = interaction.fields.getTextInputValue('farme_qty');
      const qty = parseInt(qtyStr);

      if (isNaN(qty) || qty <= 0) {
        return interaction.reply({ content: '❌ **Erro:** Quantidade de aço informada inválida. Digite um número positivo.', ephemeral: true });
      }

      // Salvar total anterior para checar meta
      const totalAnterior = obterAcoTotalMembro(user.id);

      // Atualizar Banco de Dados
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

      // Checar se bateu a meta
      const totalNovo = obterAcoTotalMembro(user.id);
      await verificarMetaAtingida(user.id, member.displayName || user.username, totalAnterior, totalNovo, guild);

      // Responder interação do membro
      await interaction.reply({
        content: `✅ **Farme Registrado!** Você registrou **${formatarNumero(qty)} kg** de aço com sucesso.\nAcumulado semanal: **${formatarNumero(totalNovo)} kg** de aço.`,
        ephemeral: true
      });

      // Enviar log para o canal de farme configurado (1525698045537161226)
      const canalFarmeLogs = guild.channels.cache.get('1525698045537161226')
        || await guild.channels.fetch('1525698045537161226').catch(() => null);
      if (canalFarmeLogs) {
        const embedFarmeLog = new EmbedBuilder()
          .setTitle('⛓️ NOVO FARME REGISTRADO • LOGS')
          .setColor('#3b82f6')
          .setDescription(
            `👤 **Membro:** <@${user.id}> (${member.displayName || user.username})\n` +
            `📦 **Quantidade:** \`${formatarNumero(qty)} kg\` de aço depositados no baú\n` +
            `📈 **Acumulado Semanal:** \`${formatarNumero(totalNovo)} kg\` / \`${formatarNumero(db.config.META_ACO_KG || 8000)} kg\``
          )
          .setFooter({ text: 'Hunters ERP • Logs de Produção' })
          .setTimestamp();

        await canalFarmeLogs.send({ embeds: [embedFarmeLog] }).catch(() => null);
      }

      // Atualizar o Painel Central de Controle
      await atualizarPainel(guild);
      return;
    }

    // SUBMIT MODAL: REGISTRAR VENDA
    if (customId === 'md_registrar_venda') {
      const weaponKey = interaction.fields.getTextInputValue('venda_weapon').trim().toLowerCase();
      const qtyStr = interaction.fields.getTextInputValue('venda_qty');
      const discountStr = interaction.fields.getTextInputValue('venda_discount') || '0';

      const qty = parseInt(qtyStr);
      const discount = parseInt(discountStr);

      const arma = ARMAS[weaponKey];
      if (!arma) {
        return interaction.reply({
          content: '❌ **Erro:** Item/Arma inválida! Opções: `ak47`, `awp`, `m16`, `sawnoff`, `glock17`, `tec9`, `taser`, `silenciador`, `carregador_est`, `grip`, `lanterna`, `box_m_pistola`, `box_m_sub`, `box_m_escopeta`, `box_m_556`, `box_m_308`, `municao_pistola_10x`, `municao_smg_10x`, `municao_escopeta_10x`, `municao_fuzil_10x`.',
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

      // Verificar estoque de vendas
      if (db.estoqueVendas < totalAcoConsumido) {
        return interaction.reply({
          content: `❌ **Erro de Estoque!** Não há aço de vendas suficiente no baú. Necessário: **${formatarNumero(totalAcoConsumido)} kg** | Disponível: **${formatarNumero(db.estoqueVendas)} kg**.`,
          ephemeral: true
        });
      }

      // Cálculos financeiros
      const precoBruto = arma.preco * qty;
      const valorDesconto = (precoBruto * discount) / 100;
      const precoLiquido = precoBruto - valorDesconto;

      // Divisão de lucros (split %)
      const pctMembro = db.config.SPLIT_CLAN_PERCENT || 50;
      const comissaoMembro = (precoLiquido * pctMembro) / 100;
      const liquidoClan = precoLiquido - comissaoMembro;

      // Atualizar Banco de Dados
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

      // Responder interação
      await interaction.reply({
        content: `✅ **Venda Registrada com Sucesso!**\n🔫 **Arma:** ${arma.nome} (x${qty})\n⛓️ **Aço de Vendas Consumido:** \`${formatarNumero(totalAcoConsumido)} kg\`\n💵 **Valor Total Líquido:** \`${formatarMoeda(precoLiquido)}\` (Desconto: ${discount}%)\n🏦 **Cofre do Clã:** +\`${formatarMoeda(liquidoClan)}\`\n💸 **Sua Comissão:** +\`${formatarMoeda(comissaoMembro)}\``,
        ephemeral: true
      });

      // Notificar no canal de logs de vendas se existir
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

    // SUBMIT MODAL: ADICIONAR AÇO (ADMINISTRATIVO)
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

    // SUBMIT MODAL: RETIRAR AÇO (ADMINISTRATIVO)
    if (customId === 'md_sub_aco') {
      const qtyStr = interaction.fields.getTextInputValue('sub_qty');
      const qty = parseInt(qtyStr);

      if (isNaN(qty) || qty <= 0) {
        return interaction.reply({ content: '❌ **Erro:** Digite um número positivo válido.', ephemeral: true });
      }

      if (db.estoque < qty) {
        return interaction.reply({ content: `❌ **Erro:** Saldo de aço insuficiente no baú. Estoque atual: **${formatarNumero(db.estoque)} kg**. `, ephemeral: true });
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

// TOKEN DE LOGIN DO CLIENT
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error("❌ Erro fatal ao iniciar o cliente Discord. Verifique se o DISCORD_TOKEN informado no arquivo .env está correto:", err.message);
});
