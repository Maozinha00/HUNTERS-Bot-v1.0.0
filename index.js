/**
 * =========================================================================
 * ⚔️ CLÃ HUNTERS - BOT DE GERENCIAMENTO ERP STANDALONE (Discord.js v14) ⚔️
 * =========================================================================
 */

require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ActivityType
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// Inicialização do Client do Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const PREFIX = process.env.PREFIX || '!';
const TOKEN = process.env.DISCORD_TOKEN;
const DB_FILE = path.join(__dirname, 'hunters_database.json');

// Estado Inicial do Banco de Dados
let db = {
  estoque: 125000, // 125k kg de aço padrão
  caixa: 1545000,  // R$ 1.545.000 padrão
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
      console.log('📦 [HUNTERS] Banco de dados carregado!');
    } else {
      salvarBanco();
    }
  } catch (erro) {
    console.error('❌ Erro ao carregar banco:', erro);
  }
}

function salvarBanco() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (erro) {
    console.error('❌ Erro ao salvar banco:', erro);
  }
}

const formatarMoeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const formatarNumero = (n) => new Intl.NumberFormat('pt-BR').format(n);

client.once('ready', () => {
  console.log(`🤖 [HUNTERS] Bot online como ${client.user.tag}!`);
  carregarBanco();
  client.user.setPresence({
    activities: [{ name: '💀 Operações HUNTERS | !ajuda', type: ActivityType.Competing }],
    status: 'dnd'
  });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // COMANDO: AJUDA (Com Botões)
  if (command === 'ajuda' || command === 'help') {
    const embedAjuda = new EmbedBuilder()
      .setTitle('⚔️ PAINEL OPERACIONAL HUNTERS ERP')
      .setDescription('Gerencie a facção através do chat com botões ou comandos de prefixo:')
      .setColor('#9333ea')
      .addFields(
        { name: '📊 Gerais & Consulta', value: `\`!estoque\` - Consulta de Aço e Kits\n\`!caixa\` - Saldo financeiro do cofre\n\`!ranking\` - Melhores vendedores do clã` },
        { name: '💥 Registro de Vendas', value: `\`!vender <@vendedor> <arma> <quantidade> [desconto_opcional]\`\n*Exemplo:* \`!vender @Membro ak47 2\`\n*Armas:* \`ak47\`, \`awp\`, \`m16\`, \`sawedoff\`, \`glock17\`` },
        { name: '⚙️ Administração (Staff)', value: `\`!addaco <kg>\` - Abastecer aço\n\`!subaco <kg>\` - Retirar aço\n\`!addcaixa <valor>\` - Depósito direto no cofre\n\`!historico\` - Logs de transações` }
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_estoque').setLabel('📦 Estoque').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('btn_caixa').setLabel('💰 Caixa Cofre').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('btn_ranking').setLabel('🏆 Ranking').setStyle(ButtonStyle.Secondary)
    );

    return message.reply({ embeds: [embedAjuda], components: [row] });
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
  if (command === 'caixa') {
    const embedCaixa = new EmbedBuilder()
      .setTitle('💰 CAIXA COFRE HUNTERS')
      .setColor('#10b981')
      .addFields(
        { name: '💵 Saldo em Caixa', value: `**${formatarMoeda(db.caixa)}**` },
        { name: '📈 Vendas Registradas', value: `**${db.vendas.length} transações**`, inline: true },
        { name: '🛠️ Alíquota Comissões', value: `**${db.config.splitPercent}%** para Vendedor`, inline: true }
      );
    return message.reply({ embeds: [embedCaixa] });
  }

  // COMANDO: VENDER
  if (command === 'vender') {
    const membro = message.mentions.members.first();
    const armaChave = args[1]?.toLowerCase();
    const quantidade = parseInt(args[2]);
    const desconto = parseInt(args[3]) || 0;

    if (!membro || !armaChave || isNaN(quantidade) || quantidade <= 0) {
      return message.reply(`❌ **Formato incorreto!** Use:\n\`${PREFIX}vender <@membro> <ak47|awp|m16|sawedoff|glock17> <quantidade> [desconto]\``);
    }

    const arma = ARMAS[armaChave];
    if (!arma) return message.reply(`❌ **Arma inválida!** Opções: \`ak47\`, \`awp\`, \`m16\`, \`sawedoff\`, \`glock17\``);

    const acoNecessario = arma.aco * quantidade;
    if (db.estoque < acoNecessario) {
      return message.reply(`❌ **Aço Insuficiente!** Necessário **${formatarNumero(acoNecessario)} kg**. Estoque atual: **${formatarNumero(db.estoque)} kg**.`);
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
        { name: '💰 Total Pago', value: `**${formatarMoeda(novaVenda.total)}**` },
        { name: '💸 Comissão Vendedor', value: `**${formatarMoeda(novaVenda.comissao)}**`, inline: true },
        { name: '🏦 Cofre HUNTERS', value: `**+${formatarMoeda(lucroClas)}**`, inline: true }
      )
      .setFooter({ text: `ID da Transação: ${novaVenda.id}` });

    return message.reply({ embeds: [embedSucesso] });
  }

  // COMANDO: RANKING
  if (command === 'ranking') {
    if (db.vendas.length === 0) return message.reply('🏆 Nenhuma venda registrada para compor o ranking.');

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
      .setDescription(rankingStr);

    return message.reply({ embeds: [embedRanking] });
  }

  // COMANDO ADMIN: ADDACO
  if (command === 'addaco') {
    if (!message.member.permissions.has('Administrator')) return message.reply('❌ Sem permissão.');
    const quantidade = parseInt(args[0]);
    if (isNaN(quantidade) || quantidade <= 0) return message.reply(`❌ Formato: \`${PREFIX}addaco <kg>\``);

    db.estoque += quantidade;
    salvarBanco();
    return message.reply(`⛓️ **Estoque atualizado:** +${formatarNumero(quantidade)} kg de aço.`);
  }
});

// Resposta aos botões clicados
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  const customId = interaction.customId;

  if (customId === 'btn_estoque') {
    const kitsProntos = Math.floor(db.estoque / db.config.kitCost);
    const embed = new EmbedBuilder()
      .setTitle('📦 ESTOQUE RÁPIDO')
      .setColor('#9333ea')
      .addFields(
        { name: 'Aço Disponível', value: `${formatarNumero(db.estoque)} kg`, inline: true },
        { name: 'Kits Produzíveis', value: `${formatarNumero(kitsProntos)} un`, inline: true }
      );
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (customId === 'btn_caixa') {
    const embed = new EmbedBuilder()
      .setTitle('💰 SALDO RÁPIDO')
      .setColor('#10b981')
      .setDescription(`Cofre atual: **${formatarMoeda(db.caixa)}**`);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

if (TOKEN) {
  client.login(TOKEN);
} else {
  console.error('❌ DISCORD_TOKEN não configurado no arquivo .env!');
}
