/**
 * =========================================================================
 * ⚔️ CLÃ HUNTERS - BOT DE GERENCIAMENTO ERP STANDALONE (Discord.js v14) ⚔️
 * =========================================================================
 *
 * Versão Ultra Moderna e Sincronizada com Interações por Botões e Modais do Discord.
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
  estoque: 69000,   // 69k kg de aço padrão
  caixa: 280000,    // R$ 280.000 padrão
  vendas: [],
  config: {
    splitPercent: 15,       // % do vendedor padrão
    steelClanPercent: 10,   // % de aço retido pro clã
    kitCost: 3000          // kg de aço por kit pronto
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
  const kitsProntos = Math.floor(db.estoque / db.config.kitCost);
  const totalVendido = db.vendas.reduce((acc, v) => acc + v.total, 0);
  const split = db.config.splitPercent;

  const embedPainel = new EmbedBuilder()
    .setTitle('🐺 HUNTERS BOT — PAINEL CENTRAL')
    .setDescription('🐺 **SISTEMA DE GESTÃO HUNTERS**\n\nControle oficial de estoque, caixa e vendas para operações táticas da facção.')
    .setColor('#a855f7')
    .setThumbnail(client.user.displayAvatarURL())
    .addFields(
      { name: '🛠️ Estoque de Aço', value: `**${formatarNumero(db.estoque)} kg**`, inline: true },
      { name: '💰 Caixa HUNTERS', value: `**${formatarMoeda(db.caixa)}**`, inline: true },
      { name: '🎁 Capacidade de Kits', value: `**${formatarNumero(kitsProntos)} Kits**`, inline: true },
      { name: '🛒 Total Vendido', value: `**${formatarMoeda(totalVendido)}**`, inline: true },
      { name: '📜 Vendas Registradas', value: `**${db.vendas.length} vendas**`, inline: true },
      { name: '📊 Divisão de Lucros', value: `🏦 **${100 - split}% Clã** | 💵 **${split}% Membro**`, inline: true }
    )
    .setFooter({ text: 'HUNTERS BOT v2.4 🐺 • Operando com segurança' })
    .setTimestamp();

  // Botões de Interação Ultra Modernos (Layout em 2 linhas)
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('painel_estoque')
      .setLabel('📦 Consultar Estoque')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('painel_addaco')
      .setLabel('➕ Adicionar Aço')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('painel_subaco')
      .setLabel('➖ Retirar Aço')
      .setStyle(ButtonStyle.Danger)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('painel_venda')
      .setLabel('💰 Registrar Venda')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('painel_caixa')
      .setLabel('🏦 Caixa')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('painel_ranking')
      .setLabel('🏆 Ranking')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('painel_historico')
      .setLabel('📜 Histórico')
      .setStyle(ButtonStyle.Secondary)
  );

  const replyOptions = { embeds: [embedPainel], components: [row1, row2] };
  
  if (targetUser) {
    return channel.send({ content: `Olá ${targetUser}, aqui está o painel central:`, ...replyOptions });
  } else {
    return channel.send(replyOptions);
  }
};

// Evento de Mensagem (Comandos de Prefixo)
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // COMANDO: AJUDA / PAINEL
  if (command === 'ajuda' || command === 'help' || command === 'painel') {
    return enviarPainelCentral(message.channel, message.author);
  }

  // COMANDO: ESTOQUE
  if (command === 'estoque') {
    const kitsProntos = Math.floor(db.estoque / db.config.kitCost);
    const reservaClan = Math.floor(db.estoque * (db.config.steelClanPercent / 100));

    const embedEstoque = new EmbedBuilder()
      .setTitle('📦 ESTOQUE GERAL — HUNTERS')
      .setColor('#9333ea')
      .addFields(
        { name: '⛓️ Total de Aço', value: `**${formatarNumero(db.estoque)} kg**`, inline: true },
        { name: '📦 Kits Prontos', value: `**${formatarNumero(kitsProntos)} un**`, inline: true },
        { name: '🔒 Retenção Clã', value: `**${db.config.steelClanPercent}%** (${formatarNumero(reservaClan)} kg)`, inline: true }
      );

    let producaoStr = '';
    Object.keys(ARMAS).forEach(key => {
      const arma = ARMAS[key];
      const maxFabricavel = Math.floor(db.estoque / arma.aco);
      producaoStr += `${arma.icon} **${arma.nome}**: ${formatarNumero(maxFabricavel)} un *(Custo: ${formatarNumero(arma.aco)}kg)*\n`;
    });
    embedEstoque.addFields({ name: '🛠️ Capacidade de Fabricação Reativa', value: producaoStr });

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
    const membro = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
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
    if (db.estoque < acoNecessario) {
      return message.reply(`❌ **Aço Insuficiente!** É necessário **${formatarNumero(acoNecessario)} kg** de aço. Estoque atual: **${formatarNumero(db.estoque)} kg**.`);
    }

    const precoBase = arma.preco * quantidade;
    const valorDesconto = precoBase * (desconto / 100);
    const totalVenda = precoBase - valorDesconto;
    const comissaoVendedor = totalVenda * (db.config.splitPercent / 100);
    const lucroClas = totalVenda - comissaoVendedor;

    db.estoque -= acoNecessario;
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

    db.vendas.push(novaVenda);
    salvarBanco();

    const embedSucesso = new EmbedBuilder()
      .setTitle('🎯 VENDA REGISTRADA COM SUCESSO')
      .setColor('#10b981')
      .addFields(
        { name: '👤 Vendedor', value: `${membro}`, inline: true },
        { name: '🔫 Armamento', value: `**${quantidade}x ${arma.nome}**`, inline: true },
        { name: '📉 Desconto', value: `**${desconto}%**`, inline: true },
        { name: '💰 Total Pago', value: `**${formatarMoeda(totalVenda)}**` },
        { name: '💸 Split Vendedor', value: `**${formatarMoeda(comissaoVendedor)}** (Comissão)`, inline: true },
        { name: '🏦 Cofre HUNTERS', value: `**+${formatarMoeda(lucroClas)}**`, inline: true },
        { name: '⛓️ Aço Consumido', value: `**-${formatarNumero(acoNecessario)} kg**`, inline: true }
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

  // COMANDO ADMIN: ADDACO
  if (command === 'addaco') {
    if (!temPermissaoEstoque(message.member)) {
      return message.reply(`❌ **Acesso Negado!** Apenas membros com o cargo <@&${CARGO_ESTOQUE_ID}> ou administradores podem adicionar aço.`);
    }

    const quantidade = parseInt(args[0]);
    if (isNaN(quantidade) || quantidade <= 0) {
      return message.reply(`❌ Use o formato: \`${PREFIX}addaco <kg>\``);
    }

    db.estoque += quantidade;
    salvarBanco();

    return message.reply(`⛓️ **Estoque Abastecido!** Foram adicionados **+${formatarNumero(quantidade)} kg** ao estoque. Estoque atual: **${formatarNumero(db.estoque)} kg**.`);
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
      return message.reply(`❌ **Quantidade insuficiente!** O estoque possui apenas **${formatarNumero(db.estoque)} kg**.`);
    }

    db.estoque -= quantidade;
    salvarBanco();

    return message.reply(`⛓️ **Retirada Efetuada!** Foram removidos **-${formatarNumero(quantidade)} kg** de aço. Estoque atual: **${formatarNumero(db.estoque)} kg**.`);
  }

  // COMANDO ADMIN: LIMPAR
  if (command === 'limpar') {
    if (!message.member.permissions.has('Administrator')) {
      return message.reply('❌ Apenas administradores do servidor podem resetar os logs de vendas.');
    }

    db.vendas = [];
    db.estoque = 69000;
    db.caixa = 280000;
    salvarBanco();

    return message.reply('🧹 **Ciclo Resetado!** Todos os logs de vendas foram apagados e os valores retornaram ao padrão de fábrica (69.000 kg aço, R$ 280.000 caixa).');
  }
});

// Manipulador de Interações (Botões e Modais)
client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    const customId = interaction.customId;

    // BOTÃO: CONSULTAR ESTOQUE
    if (customId === 'painel_estoque') {
      const kitsProntos = Math.floor(db.estoque / db.config.kitCost);
      const reservaClan = Math.floor(db.estoque * (db.config.steelClanPercent / 100));

      const embedEstoque = new EmbedBuilder()
        .setTitle('⛓️ CONSULTA RÁPIDA: ESTOQUE')
        .setColor('#9333ea')
        .addFields(
          { name: 'Aço em Estoque', value: `\`${formatarNumero(db.estoque)} kg\``, inline: true },
          { name: 'Kits Produzíveis', value: `\`${formatarNumero(kitsProntos)} un\``, inline: true },
          { name: 'Reserva do Clã', value: `\`${formatarNumero(reservaClan)} kg\``, inline: true }
        );

      return interaction.reply({ embeds: [embedEstoque], ephemeral: true });
    }

    // BOTÃO: CAIXA
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

    // BOTÃO: RANKING
    if (customId === 'painel_ranking') {
      if (db.vendas.length === 0) {
        return interaction.reply({ content: '🏆 Nenhum dada de vendas registrado para gerar o ranking ainda.', ephemeral: true });
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

    // BOTÃO: HISTÓRICO
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

    // BOTÃO: ADICIONAR AÇO (Abre Modal)
    if (customId === 'painel_addaco') {
      // Verificar permissão
      if (!temPermissaoEstoque(interaction.member)) {
        return interaction.reply({ 
          content: `❌ **Acesso Negado!** Apenas membros com o cargo <@&${CARGO_ESTOQUE_ID}> ou administradores podem adicionar aço ao estoque.`, 
          ephemeral: true 
        });
      }

      // Criar Modal do Discord
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

    // BOTÃO: RETIRAR AÇO (Abre Modal)
    if (customId === 'painel_subaco') {
      // Verificar permissão
      if (!temPermissaoEstoque(interaction.member)) {
        return interaction.reply({ 
          content: `❌ **Acesso Negado!** Apenas membros com o cargo <@&${CARGO_ESTOQUE_ID}> ou administradores podem retirar aço do estoque.`, 
          ephemeral: true 
        });
      }

      // Criar Modal do Discord
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

    // BOTÃO: REGISTRAR VENDA (Abre Modal)
    if (customId === 'painel_venda') {
      // Criar Modal do Discord com campos de dados da venda
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

    // MODAL: ADICIONAR AÇO
    if (customId === 'modal_addaco') {
      const quantidade = parseInt(interaction.fields.getTextInputValue('aco_quantidade'));

      if (isNaN(quantidade) || quantidade <= 0) {
        return interaction.reply({ content: '❌ **Quantidade inválida!** Digite apenas números inteiros maiores que zero.', ephemeral: true });
      }

      db.estoque += quantidade;
      salvarBanco();

      // Envia confirmação ephemeral para quem realizou e cria anúncio público no canal
      await interaction.reply({ content: `⛓️ **Sucesso!** Adicionado **+${formatarNumero(quantidade)} kg** ao estoque.`, ephemeral: true });
      
      const embedPublico = new EmbedBuilder()
        .setTitle('⛓️ ENTRADA DE MATERIAL NO ESTOQUE')
        .setColor('#248046')
        .addFields(
          { name: '👤 Responsável', value: `${interaction.user}`, inline: true },
          { name: '📦 Quantidade Adicionada', value: `**+${formatarNumero(quantidade)} kg**`, inline: true },
          { name: '📊 Estoque Atual', value: `**${formatarNumero(db.estoque)} kg de aço**`, inline: true }
        )
        .setTimestamp();

      return interaction.channel.send({ embeds: [embedPublico] });
    }

    // MODAL: RETIRAR AÇO
    if (customId === 'modal_subaco') {
      const quantidade = parseInt(interaction.fields.getTextInputValue('aco_quantidade'));

      if (isNaN(quantidade) || quantidade <= 0) {
        return interaction.reply({ content: '❌ **Quantidade inválida!** Digite apenas números inteiros maiores que zero.', ephemeral: true });
      }

      if (db.estoque < quantidade) {
        return interaction.reply({ content: `❌ **Estoque insuficiente!** O cofre de aço possui apenas **${formatarNumero(db.estoque)} kg**.`, ephemeral: true });
      }

      db.estoque -= quantidade;
      salvarBanco();

      await interaction.reply({ content: `⛓️ **Sucesso!** Retirado **-${formatarNumero(quantidade)} kg** de aço.`, ephemeral: true });
      
      const embedPublico = new EmbedBuilder()
        .setTitle('⛓️ RETIRADA DE MATERIAL NO ESTOQUE')
        .setColor('#da373c')
        .addFields(
          { name: '👤 Responsável', value: `${interaction.user}`, inline: true },
          { name: '📦 Quantidade Retirada', value: `**-${formatarNumero(quantidade)} kg**`, inline: true },
          { name: '📊 Estoque Atual', value: `**${formatarNumero(db.estoque)} kg de aço**`, inline: true }
        )
        .setTimestamp();

      return interaction.channel.send({ embeds: [embedPublico] });
    }

    // MODAL: REGISTRAR VENDA
    if (customId === 'modal_vender') {
      const vendedorInput = interaction.fields.getTextInputValue('vendedor_id');
      const armaChave = interaction.fields.getTextInputValue('arma_chave').toLowerCase().trim();
      const quantidade = parseInt(interaction.fields.getTextInputValue('quantidade'));
      const desconto = parseInt(interaction.fields.getTextInputValue('desconto')) || 0;

      // Resolver Vendedor pelo ID ou Menção
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
      if (db.estoque < acoNecessario) {
        return interaction.reply({ content: `❌ **Aço Insuficiente!** Necessário **${formatarNumero(acoNecessario)} kg**. Estoque atual: **${formatarNumero(db.estoque)} kg**.`, ephemeral: true });
      }

      const precoBase = arma.preco * quantidade;
      const valorDesconto = precoBase * (desconto / 100);
      const totalVenda = precoBase - valorDesconto;
      const comissaoVendedor = totalVenda * (db.config.splitPercent / 100);
      const lucroClas = totalVenda - comissaoVendedor;

      db.estoque -= acoNecessario;
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

      db.vendas.push(novaVenda);
      salvarBanco();

      await interaction.reply({ content: `🎯 Venda **${novaVenda.id}** lançada com sucesso no ERP!`, ephemeral: true });

      const embedSucesso = new EmbedBuilder()
        .setTitle('🎯 VENDA REGISTRADA COM SUCESSO')
        .setColor('#10b981')
        .addFields(
          { name: '👤 Vendedor', value: `${vendedorMembro}`, inline: true },
          { name: '🔫 Armamento', value: `**${quantidade}x ${arma.nome}**`, inline: true },
          { name: '📉 Desconto', value: `**${desconto}%**`, inline: true },
          { name: '💰 Total Pago', value: `**${formatarMoeda(totalVenda)}**` },
          { name: '💸 Split Vendedor', value: `**${formatarMoeda(comissaoVendedor)}** (Comissão)`, inline: true },
          { name: '🏦 Cofre HUNTERS', value: `**+${formatarMoeda(lucroClas)}**`, inline: true },
          { name: '⛓️ Aço Consumido', value: `**-${formatarNumero(acoNecessario)} kg**`, inline: true }
        )
        .setFooter({ text: `ID: ${novaVenda.id} • Lançado via Painel Interativo` })
        .setTimestamp();

      return interaction.channel.send({ embeds: [embedSucesso] });
    }
  }
});

if (TOKEN) {
  client.login(TOKEN).catch(err => {
    console.error('❌ Erro de login no Discord. Verifique o TOKEN:', err.message);
  });
} else {
  console.error('❌ ERRO CRÍTICO: Variável DISCORD_TOKEN ou TOKEN não encontrada no seu ambiente!');
}
