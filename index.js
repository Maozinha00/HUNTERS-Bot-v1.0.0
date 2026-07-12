/**
 * 🐺 HUNTERS BOT - STANDALONE SCRIPT v3.0 🐺
 * Desenvolvido para o clã/facção HUNTERS.
 * 
 * 🚀 VERSÃO STANDALONE (100% OFFLINE - BANCO DE DADOS LOCAL JSON)
 * Gerencie estoque, vendas, caixa, comissões, ranking e logs diretamente pelo Discord.
 * Suporta persistência permanente de dados em um arquivo 'database.json'.
 */

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DISCORD_TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID; // Opcional ID do Cargo administrativo no .env
const DB_FILE = path.join(__dirname, 'database.json');

if (!DISCORD_TOKEN) {
  console.error("❌ ERRO: O token do bot não foi configurado no arquivo .env!");
  process.exit(1);
}

// Inicializa a conexão com o Discord
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

// Carrega ou inicializa o Banco de Dados JSON
function loadDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initialData = {
        estoque: 150000, // 150.000 kg de aço iniciais
        caixa: 1500000,   // R$ 1.500.000,00 iniciais
        vendas: [],
        logs: [],
        settings: {
          kitCost: 5000,
          steelClanPercent: 10
        }
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
      console.log("💾 Banco de dados 'database.json' criado com dados iniciais!");
      return initialData;
    }
    const rawData = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error("❌ Erro ao ler/criar o banco de dados JSON:", error);
    return {
      estoque: 150000,
      caixa: 1500000,
      vendas: [],
      logs: [],
      settings: { kitCost: 5000, steelClanPercent: 10 }
    };
  }
}

// Salva dados no Banco de Dados JSON
function saveDatabase(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error("❌ Erro ao salvar dados no 'database.json':", error);
  }
}

// Formatação auxiliar
const formatNumber = (num) => Number(num).toLocaleString("pt-BR");
const formatMoney = (num) => `R$ ${formatNumber(num)}`;

// Sistema de Permissões: Verifica se o membro é administrador ou tem o cargo específico do .env
function hasAdminPermission(message) {
  if (message.guild.ownerId === message.author.id) return true;
  if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (ADMIN_ROLE_ID && message.member.roles.cache.has(ADMIN_ROLE_ID)) {
    return true;
  }
  return false;
}

// Grava um log administrativo no banco JSON
function writeLog(data, user, action, details) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    userId: user.id,
    userName: user.username,
    action: action,
    details: details
  };
  data.logs = data.logs || [];
  data.logs.unshift(logEntry);
  if (data.logs.length > 50) {
    data.logs = data.logs.slice(0, 50);
  }
}

// Evento: Bot pronto
client.once('ready', () => {
  console.log(`===============================================
🐺 BOT HUNTERS ONLINE E PRONTO PARA COMBATE!
🤖 Conectado como: ${client.user.tag}
💾 Banco JSON: Ativo e persistente.
🛡️ Cargo Admin: ${ADMIN_ROLE_ID ? ADMIN_ROLE_ID : "Administrador Nativo"}
===============================================`);
});

// Evento: Mensagem recebida
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return; // Ignora DMs
  if (!message.content.startsWith('!')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Carrega os dados atualizados a cada comando
  const localData = loadDatabase();

  // COMANDO: !painel
  if (command === 'painel') {
    const kits = Math.floor(localData.estoque / localData.settings.kitCost);
    const totalVendido = localData.vendas.reduce((acc, v) => acc + v.total, 0);

    const embed = new EmbedBuilder()
      .setTitle("🐺 HUNTERS — PAINEL OPERACIONAL")
      .setColor("#9333EA")
      .setDescription("### 📊 Status de Recursos e Operação do Clã (Persistência JSON)")
      .addFields(
        { name: "🛠️ Estoque de Aço", value: `**${formatNumber(localData.estoque)} kg**`, inline: true },
        { name: "🏦 Caixa (70%)", value: `**${formatMoney(localData.caixa)}**`, inline: true },
        { name: "🎁 Kits Prontos", value: `**${formatNumber(kits)} Kits**`, inline: true },
        { name: "🛒 Total Vendido", value: `**${formatMoney(totalVendido)}**`, inline: true },
        { name: "📜 Lançamentos", value: `**${localData.vendas.length} registros**`, inline: true },
        { name: "⚖️ Repasse", value: `**70% Clã / 30% Membro**`, inline: true }
      )
      .setFooter({ text: "Hunters Management v3.0 | JSON DB", iconURL: client.user.displayAvatarURL() })
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
      return message.reply("⚠️ **Uso correto:** `!venda <item> <quantidade> [--desconto]`\nExemplo: `!venda ak47 5` ou `!venda glock17 10 --desconto`\nUse `!venda itens` para ver a lista de códigos.");
    }

    if (itemArg.toLowerCase() === 'itens') {
      let itemsList = "";
      Object.entries(ITENS_DB).forEach(([key, item]) => {
        itemsList += `• **${key}**: ${item.name} | Custo: ${formatNumber(item.steel)} kg | Valor: ${formatMoney(item.value)}\n`;
      });
      const embed = new EmbedBuilder()
        .setTitle("🔫 ITENS E EQUIPAMENTOS CADASTRADOS")
        .setColor("#3B82F6")
        .setDescription(itemsList)
        .setFooter({ text: "Use estes códigos no comando de venda!" });
      return message.reply({ embeds: [embed] });
    }

    const itemKey = itemArg.toLowerCase();
    const item = ITENS_DB[itemKey];
    if (!item) {
      return message.reply(`❌ **Item inválido!** Opções: \`${Object.keys(ITENS_DB).join(", ")}\` ou consulte \`!venda itens\``);
    }

    const qty = parseInt(qtdArg);
    if (isNaN(qty) || qty <= 0) {
      return message.reply("❌ **Erro:** A quantidade inserida deve ser um número inteiro maior que zero.");
    }

    const aplicarDesconto = descArg === '--desconto';
    let precoUnitario = item.value;
    if (aplicarDesconto) {
      precoUnitario = precoUnitario * 0.9; // 10% desconto
    }

    const acoConsumido = item.steel * qty;
    const faturamentoBruto = precoUnitario * qty;

    if (localData.estoque < acoConsumido) {
      return message.reply(`❌ **Estoque insuficiente!** Essa venda exige **${formatNumber(acoConsumido)} kg** de aço, mas restam apenas **${formatNumber(localData.estoque)} kg** no estoque geral.`);
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
      date: new Date().toISOString(),
      desconto: aplicarDesconto
    };

    localData.vendas.push(novaVenda);
    
    // Escreve log administrativo
    writeLog(localData, message.author, "REGISTRO_VENDA", `Venda de ${qty}x ${item.name} por ${formatMoney(faturamentoBruto)}`);
    
    // Salva o banco
    saveDatabase(localData);

    const embed = new EmbedBuilder()
      .setTitle("✅ VENDA REGISTRADA COM SUCESSO!")
      .setColor("#10B981")
      .setDescription(`👤 Vendedor: <@${message.author.id}>\n🔫 Equipamento: **${item.name}** (${qty}x)\n🛠️ Aço consumido: **${formatNumber(acoConsumido)} kg**${aplicarDesconto ? ' \n⚠️ *(10% de desconto aplicado)*' : ''}`)
      .addFields(
        { name: "💰 Faturamento Bruto", value: `**${formatMoney(faturamentoBruto)}**`, inline: true },
        { name: "🏦 Entrada no Caixa (70%)", value: `**${formatMoney(valorCla)}**`, inline: true },
        { name: "💸 Comissão Membro (30%)", value: `**${formatMoney(valorMembro)}**`, inline: true }
      )
      .setFooter({ text: "Venda gravada com sucesso no banco de dados JSON persistente." })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // COMANDO: !addaco <quantidade>
  if (command === 'addaco') {
    if (!hasAdminPermission(message)) {
      return message.reply("❌ **Permissão Negada:** Apenas administradores podem abastecer o estoque.");
    }

    const qty = parseInt(args[0]);
    if (isNaN(qty) || qty <= 0) {
      return message.reply("⚠️ **Uso correto:** `!addaco <quantidade_kg>`\nExemplo: `!addaco 5000`");
    }

    localData.estoque += qty;
    writeLog(localData, message.author, "ADICIONAR_ACO", `Adicionados +${qty} kg ao estoque`);
    saveDatabase(localData);

    return message.reply(`✅ **Estoque Abastecido:** Adicionados **${formatNumber(qty)} kg** de aço. Novo total: **${formatNumber(localData.estoque)} kg**.`);
  }

  // COMANDO: !remaco <quantidade>
  if (command === 'remaco') {
    if (!hasAdminPermission(message)) {
      return message.reply("❌ **Permissão Negada:** Apenas administradores podem debitar do estoque.");
    }

    const qty = parseInt(args[0]);
    if (isNaN(qty) || qty <= 0) {
      return message.reply("⚠️ **Uso correto:** `!remaco <quantidade_kg>`\nExemplo: `!remaco 2000`");
    }

    if (localData.estoque < qty) {
      return message.reply(`❌ **Estoque insuficiente!** Restam apenas **${formatNumber(localData.estoque)} kg**.`);
    }

    localData.estoque -= qty;
    writeLog(localData, message.author, "REMOVER_ACO", `Removidos -${qty} kg do estoque`);
    saveDatabase(localData);

    return message.reply(`✅ **Estoque Reduzido:** Removidos **${formatNumber(qty)} kg** de aço. Novo total: **${formatNumber(localData.estoque)} kg**.`);
  }

  // COMANDO: !addcaixa <valor>
  if (command === 'addcaixa') {
    if (!hasAdminPermission(message)) {
      return message.reply("❌ **Permissão Negada:** Apenas administradores podem depositar fundos.");
    }

    const qty = parseInt(args[0]);
    if (isNaN(qty) || qty <= 0) {
      return message.reply("⚠️ **Uso correto:** `!addcaixa <valor_reais>`\nExemplo: `!addcaixa 50000`");
    }

    localData.caixa += qty;
    writeLog(localData, message.author, "ADICIONAR_CAIXA", `Depósito de ${formatMoney(qty)} no caixa`);
    saveDatabase(localData);

    return message.reply(`✅ **Caixa Alimentado:** Depositados **${formatMoney(qty)}** no Caixa. Novo saldo: **${formatMoney(localData.caixa)}**.`);
  }

  // COMANDO: !remcaixa <valor>
  if (command === 'remcaixa') {
    if (!hasAdminPermission(message)) {
      return message.reply("❌ **Permissão Negada:** Apenas administradores podem sacar do caixa.");
    }

    const qty = parseInt(args[0]);
    if (isNaN(qty) || qty <= 0) {
      return message.reply("⚠️ **Uso correto:** `!remcaixa <valor_reais>`\nExemplo: `!remcaixa 30000`");
    }

    if (localData.caixa < qty) {
      return message.reply(`❌ **Saldo insuficiente!** Resta apenas **${formatMoney(localData.caixa)}**.`);
    }

    localData.caixa -= qty;
    writeLog(localData, message.author, "REMOVER_CAIXA", `Retirada de ${formatMoney(qty)} do caixa`);
    saveDatabase(localData);

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
      list += `${medal} <@${userId}> — **${formatMoney(stats.total)}** (${stats.count} vendas)\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle("🏆 RANKING DE VENDAS - HUNTERS ELITE")
      .setColor("#F59E0B")
      .setDescription(list || "Nenhuma venda registrada até o momento.")
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // COMANDO: !logs
  if (command === 'logs') {
    if (!hasAdminPermission(message)) {
      return message.reply("❌ **Permissão Negada:** Apenas administradores podem ver os logs operacionais.");
    }

    const logsList = (localData.logs || [])
      .slice(0, 10)
      .map(l => `\`[${new Date(l.timestamp).toLocaleTimeString('pt-BR')}]\` **${l.userName}**: ${l.action} -> *${l.details}*`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle("📜 ÚLTIMOS LOGS OPERACIONAIS")
      .setColor("#E2E8F0")
      .setDescription(logsList || "Nenhum log registrado.")
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
        { name: "📊 `!painel`", value: "Exibe o status geral de recursos do clã com botões de atalho." },
        { name: "🛒 `!venda <item> <qtd> [--desconto]`", value: "Registra uma venda, calcula o rateio (70% clã / 30% membro) e debita o aço correspondente do estoque." },
        { name: "🔫 `!venda itens`", value: "Mostra a tabela de todos os itens cadastrados com custos e valores." },
        { name: "🏆 `!ranking`", value: "Mostra o ranking de desempenho dos melhores vendedores." },
        { name: "📜 `!logs`", value: "Mostra o histórico das últimas 10 ações de controle (Apenas Admins)." },
        { name: "📦 `!addaco <qtd>` / `!remaco <qtd>`", value: "Adiciona ou remove aço do estoque geral (Apenas Admins)." },
        { name: "🏦 `!addcaixa <valor>` / `!remcaixa <valor>`", value: "Realiza depósitos ou saques diretos no caixa do clã (Apenas Admins)." }
      )
      .setFooter({ text: "Hunters Management v3.0 | JSON DB" })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }
});

// Suporte a botões interativos
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const localData = loadDatabase();

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
      .slice(0, 5);

    let list = "";
    sorted.forEach(([userId, stats], idx) => {
      const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `🔹`;
      list += `${medal} <@${userId}> — **${formatMoney(stats.total)}** (${stats.count} vendas)\n`;
    });

    return interaction.reply({
      content: `🏆 **TOP 5 VENDEDORES:**\n\n${list || "Nenhuma venda registrada."}`,
      ephemeral: true
    });
  }
});

client.login(DISCORD_TOKEN);
