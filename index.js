/**
 * 🐺 HUNTERS BOT - STANDALONE SCRIPT v3.0 🐺
 * Desenvolvido para o clã/facção HUNTERS.
 * 
 * 🚀 VERSÃO STANDALONE (100% OFFLINE - SEM API/ERP REQUISITADO)
 * Gerencie estoque, vendas, caixa e comissões diretamente pelo Discord.
 * Requisitos: Node.js v18+ (guarda estado em memória!)
 */

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const DISCORD_TOKEN = process.env.TOKEN || process.env.TOKEN;

if (!DISCORD_TOKEN) {
  console.error("❌ ERRO: O token do bot (DISCORD_TOKEN ou TOKEN) não foi configurado no arquivo .env!");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Banco de dados dos armamentos da Hunters
const ITENS_DB = {
  ak47: { name: "AK-47", steel: 2700, value: 35000 },
  awp: { name: "AWP", steel: 3000, value: 65000 },
  m16: { name: "M16", steel: 2700, value: 35000 },
  sawedoff: { name: "Sawed-Off", steel: 1200, value: 20000 },
  glock17: { name: "Glock 17", steel: 120, value: 5000 },
  tec9: { name: "TEC-9", steel: 900, value: 15000 },
  taser: { name: "Taser", steel: 700, value: 10000 },
  box556: { name: "Box 5.56", steel: 120, value: 5000 },
  box308: { name: "Box .308", steel: 200, value: 5000 }
};

// Banco de dados local em memória (Simula o ERP)
let localData = {
  estoque: 150000, // Estoque inicial padrão em kg
  caixa: 1500000,   // Caixa inicial padrão em R$
  vendas: [],
  settings: {
    kitCost: 5000,
    steelClanPercent: 10
  }
};

const formatNumber = (num) => Number(num).toLocaleString("pt-BR");
const formatMoney = (num) => `R$ ${formatNumber(num)}`;

// Ouvindo o evento correto 'clientReady' para evitar warnings
client.once('clientReady', () => {
  console.log(`===============================================`);
  console.log(`🐺 BOT HUNTERS ONLINE E PRONTO PARA COMBATE!`);
  console.log(`🤖 Conectado como: ${client.user.tag}`);
  console.log(`💻 Modo: Standalone (Sem API - Armazenamento em Memória)`);
  console.log(`===============================================`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('!')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // COMANDO: !painel
  if (command === 'painel') {
    const kits = Math.floor(localData.estoque / localData.settings.kitCost);
    const totalVendido = localData.vendas.reduce((acc, v) => acc + v.total, 0);

    const embed = new EmbedBuilder()
      .setTitle("🐺 HUNTERS — PAINEL STANDALONE (LOCAL)")
      .setColor("#9333EA")
      .setDescription("### 📊 Status de Recursos e Operação do Clã (Sem API)")
      .addFields(
        { name: "🛠️ Estoque de Aço", value: `**${formatNumber(localData.estoque)} kg**`, inline: true },
        { name: "🏦 Caixa (70%)", value: `**${formatMoney(localData.caixa)}**`, inline: true },
        { name: "🎁 Kits Prontos", value: `**${formatNumber(kits)} Kits**`, inline: true },
        { name: "🛒 Total Vendido", value: `**${formatMoney(totalVendido)}**`, inline: true },
        { name: "📜 Lançamentos", value: `**${localData.vendas.length} registros**`, inline: true },
        { name: "⚖️ Repasse", value: `**70% Clã / 30% Membro**`, inline: true }
      )
      .setFooter({ text: "Hunters Standalone Bot", iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_estoque').setLabel('Estoque 📦').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('btn_caixa').setLabel('Caixa 🏦').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('btn_ranking').setLabel('Ranking 🏆').setStyle(ButtonStyle.Primary)
    );

    return message.reply({ embeds: [embed], components: [row] });
  }

  // COMANDO: !venda <item> <quantidade> [--desconto]
  if (command === 'venda') {
    const itemArg = args[0];
    const qtdArg = args[1];
    const descArg = args[2];

    if (!itemArg || !qtdArg) {
      return message.reply("⚠️ **Uso correto:** `!venda <item> <quantidade> [--desconto]`\nExemplo: `!venda ak47 5`");
    }

    const itemKey = itemArg.toLowerCase();
    const item = ITENS_DB[itemKey];
    if (!item) {
      return message.reply(`❌ **Item inválido!** Opções: ${Object.keys(ITENS_DB).join(", ")}`);
    }

    const qty = parseInt(qtdArg);
    if (isNaN(qty) || qty <= 0) {
      return message.reply("❌ **Erro:** A quantidade inserida deve ser um número maior que zero.");
    }

    const aplicarDesconto = descArg === '--desconto';
    let precoUnitario = item.value;
    if (aplicarDesconto) {
      precoUnitario = precoUnitario * 0.9; // 10% desconto
    }

    const acoConsumido = item.steel * qty;
    const faturamentoBruto = precoUnitario * qty;

    if (localData.estoque < acoConsumido) {
      return message.reply(`❌ **Estoque insuficiente!** Essa venda exige **${formatNumber(acoConsumido)} kg** de aço, mas restam apenas **${formatNumber(localData.estoque)} kg**.`);
    }

    // Calcula divisões (70% Clã / 30% Membro)
    const valorCla = Math.floor(faturamentoBruto * 0.7);
    const valorMembro = Math.floor(faturamentoBruto * 0.3);

    // Efetiva a transação no banco local
    localData.estoque -= acoConsumido;
    localData.caixa += valorCla;

    const novaVenda = {
      id: Date.now().toString(),
      userId: message.author.id,
      userName: message.author.username,
      item: item.name,
      quantidade: qty,
      aco: acoConsumido,
      total: faturamentoBruto,
      cla: valorCla,
      membro: valorMembro,
      date: new Date().toISOString()
    };

    localData.vendas.push(novaVenda);

    const embed = new EmbedBuilder()
      .setTitle("✅ VENDA REGISTRADA (STANDALONE)!")
      .setColor("#10B981")
      .setDescription(`👤 Vendedor: <@${message.author.id}>\n🔫 Equipamento: **${item.name}** (${qty}x)\n🛠️ Aço consumido: ${formatNumber(acoConsumido)} kg`)
      .addFields(
        { name: "💰 Faturamento Bruto", value: `**${formatMoney(faturamentoBruto)}**`, inline: true },
        { name: "🏦 Entrada no Caixa (70%)", value: formatMoney(valorCla), inline: true },
        { name: "💸 Comissão Recebida (30%)", value: formatMoney(valorMembro), inline: true }
      )
      .setFooter({ text: "Operação efetuada e gravada em memória local." })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // COMANDO: !addaco <quantidade>
  if (command === 'addaco') {
    const qty = parseInt(args[0]);
    if (isNaN(qty) || qty <= 0) {
      return message.reply("⚠️ **Uso correto:** `!addaco <quantidade_kg>`\nExemplo: `!addaco 5000`");
    }
    localData.estoque += qty;
    return message.reply(`✅ **Estoque Abastecido:** Adicionados **${formatNumber(qty)} kg** de aço. Novo total: **${formatNumber(localData.estoque)} kg**.`);
  }

  // COMANDO: !remaco <quantidade>
  if (command === 'remaco') {
    const qty = parseInt(args[0]);
    if (isNaN(qty) || qty <= 0) {
      return message.reply("⚠️ **Uso correto:** `!remaco <quantidade_kg>`\nExemplo: `!remaco 2000`");
    }
    if (localData.estoque < qty) {
      return message.reply(`❌ **Estoque insuficiente!** Restam apenas **${formatNumber(localData.estoque)} kg**.`);
    }
    localData.estoque -= qty;
    return message.reply(`✅ **Estoque Reduzido:** Removidos **${formatNumber(qty)} kg** de aço. Novo total: **${formatNumber(localData.estoque)} kg**.`);
  }

  // COMANDO: !addcaixa <valor>
  if (command === 'addcaixa') {
    const qty = parseInt(args[0]);
    if (isNaN(qty) || qty <= 0) {
      return message.reply("⚠️ **Uso correto:** `!addcaixa <valor_reais>`\nExemplo: `!addcaixa 50000`");
    }
    localData.caixa += qty;
    return message.reply(`✅ **Caixa Alimentado:** Depositados **${formatMoney(qty)}** no Caixa. Novo saldo: **${formatMoney(localData.caixa)}**.`);
  }

  // COMANDO: !remcaixa <valor>
  if (command === 'remcaixa') {
    const qty = parseInt(args[0]);
    if (isNaN(qty) || qty <= 0) {
      return message.reply("⚠️ **Uso correto:** `!remcaixa <valor_reais>`\nExemplo: `!remcaixa 30000`");
    }
    if (localData.caixa < qty) {
      return message.reply(`❌ **Saldo insuficiente!** Resta apenas **${formatMoney(localData.caixa)}**.`);
    }
    localData.caixa -= qty;
    return message.reply(`✅ **Retirada Efetuada:** Sacados **${formatMoney(qty)}** do Caixa. Novo saldo: **${formatMoney(localData.caixa)}**.`);
  }

  // COMANDO: !ranking
  if (command === 'ranking') {
    const rankingMap = {};
    localData.vendas.forEach(v => {
      if (!rankingMap[v.userId]) {
        rankingMap[v.userId] = { total: 0, count: 0, name: v.userName };
      }
      rankingMap[v.userId].total += v.total;
      rankingMap[v.userId].count++;
    });

    const sorted = Object.entries(rankingMap)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10);

    let list = "";
    sorted.forEach(([userId, stats], idx) => {
      const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `🔹`;
      list += `${medal} <@${userId}> (${stats.name}) — **${formatMoney(stats.total)}** (${stats.count} vendas)\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle("🏆 RANKING DE VENDAS - HUNTERS ELITE")
      .setColor("#F59E0B")
      .setDescription(list || "Nenhuma venda registrada.")
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // COMANDO: !ajuda
  if (command === 'ajuda') {
    const embed = new EmbedBuilder()
      .setTitle("📖 GUIA DE COMANDOS - BOT HUNTERS")
      .setColor("#3B82F6")
      .setDescription("Aqui estão os comandos operacionais disponíveis no Bot:")
      .addFields(
        { name: "📊 `!painel`", value: "Exibe o status geral de recursos e botões rápidos." },
        { name: "🛒 `!venda <item> <qtd> [--desconto]`", value: "Registra uma venda, calcula divisões e debita do estoque." },
        { name: "🏆 `!ranking`", value: "Mostra o ranking dos melhores vendedores do clã." },
        { name: "📦 `!addaco <qtd>` / `!remaco <qtd>`", value: "Adiciona ou remove aço do estoque geral." },
        { name: "🏦 `!addcaixa <valor>` / `!remcaixa <valor>`", value: "Deposita ou retira fundos do caixa do clã." }
      )
      .setFooter({ text: "Hunters Management v3.0" })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
});

// Suporte a botões interativos
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'btn_estoque') {
    const clanAco = Math.floor(localData.estoque * (localData.settings.steelClanPercent / 100));
    return interaction.reply({
      content: `📦 **ESTOQUE GERAL:** ${formatNumber(localData.estoque)} kg de Aço\n🛡️ **Reserva Estratégica do Clã:** ${formatNumber(clanAco)} kg`,
      ephemeral: true
    });
  }

  if (interaction.customId === 'btn_caixa') {
    return interaction.reply({
      content: `🏦 **SALDO ATUAL DO CAIXA:** ${formatMoney(localData.caixa)} (Destinado à expansão e base do clã)`,
      ephemeral: true
    });
  }

  if (interaction.customId === 'btn_ranking') {
    return interaction.reply({
      content: `🏆 Use o comando \`!ranking\` no chat público para visualizar a classificação de desempenho!`,
      ephemeral: true
    });
  }
});

client.login(TOKEN);
