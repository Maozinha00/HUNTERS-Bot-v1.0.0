/**
 * 🐺 HUNTERS BOT - STANDALONE SCRIPT v3.5 🐺
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
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID; // Opcional: ID do cargo administrativo no arquivo .env
const DB_FILE = path.join(__dirname, 'database.json');
const BACKUP_FILE = path.join(__dirname, 'database_backup.json');

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

// Carrega ou inicializa o Banco de Dados JSON (com suporte a Backup contra corrupção)
function loadDatabase() {
  const defaultData = {
    estoque: 150000, // 150.000 kg de aço iniciais
    caixa: 1500000,   // R$ 1.500.000,00 iniciais
    vendas: [],
    logs: [],
    settings: {
      kitCost: 5000,
      steelClanPercent: 10,
      clanSplitPercent: 70
    }
  };

  try {
    if (!fs.existsSync(DB_FILE)) {
      // Se não há DB principal, tenta o backup antes de criar um novo
      if (fs.existsSync(BACKUP_FILE)) {
        const rawBackup = fs.readFileSync(BACKUP_FILE, 'utf8');
        const parsedBackup = JSON.parse(rawBackup);
        fs.writeFileSync(DB_FILE, JSON.stringify(parsedBackup, null, 2), 'utf8');
        console.log("♻️ Banco de dados restaurado a partir do arquivo de backup!");
        return parsedBackup;
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
      console.log("💾 Banco de dados 'database.json' criado com dados iniciais!");
      return defaultData;
    }
    const rawData = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(rawData);
    
    // Garante que configurações padrão existam
    parsed.settings = parsed.settings || {};
    if (parsed.settings.clanSplitPercent === undefined) parsed.settings.clanSplitPercent = 70;
    if (parsed.settings.kitCost === undefined) parsed.settings.kitCost = 5000;
    if (parsed.settings.steelClanPercent === undefined) parsed.settings.steelClanPercent = 10;
    
    return parsed;
  } catch (error) {
    console.error("❌ Erro ao ler database.json, tentando restaurar do backup:", error);
    if (fs.existsSync(BACKUP_FILE)) {
      try {
        const rawBackup = fs.readFileSync(BACKUP_FILE, 'utf8');
        const parsedBackup = JSON.parse(rawBackup);
        fs.writeFileSync(DB_FILE, JSON.stringify(parsedBackup, null, 2), 'utf8');
        console.log("♻️ Recuperação emergencial de backup concluída!");
        return parsedBackup;
      } catch (backupErr) {
        console.error("❌ Falha crítica: O backup também está corrompido:", backupErr);
      }
    }
    return defaultData;
  }
}

// Salva dados no Banco de Dados JSON e cria um backup de segurança
function saveDatabase(data) {
  try {
    const serialized = JSON.stringify(data, null, 2);
    fs.writeFileSync(DB_FILE, serialized, 'utf8');
    fs.writeFileSync(BACKUP_FILE, serialized, 'utf8'); // Mantém backup atualizado
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
🐺 BOT HUNTERS STANDALONE ONLINE E PRONTO PARA COMBATE!
🤖 Conectado como: ${client.user.tag}
💾 Banco JSON: Ativo com backup de segurança.
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

  try {
    // COMANDO: !painel
    if (command === 'painel') {
      const kits = Math.floor(localData.estoque / localData.settings.kitCost);
      const totalVendido = localData.vendas.reduce((acc, v) => acc + v.total, 0);
      const split = localData.settings.clanSplitPercent || 70;

      // Alinhamento inteligente para moldura ASCII
      const padLine = (label, value, width = 38) => {
        const separator = " : ";
        const combinedLength = label.length + separator.length + value.length;
        const spaces = width - combinedLength;
        if (spaces <= 0) return label + separator + value;
        return label + " ".repeat(spaces) + separator + value;
      };

      const line1 = padLine("ESTOQUE DE AÇO", formatNumber(localData.estoque) + " kg", 38);
      const line2 = padLine("CAIXA DO CLÃ", formatMoney(localData.caixa), 38);
      const line3 = padLine("KITS DISPONÍVEIS", formatNumber(kits) + " Unidades", 38);
      const line4 = padLine("TOTAL VENDIDO", formatMoney(totalVendido), 38);
      const line5 = padLine("LANÇAMENTOS SINC", formatNumber(localData.vendas.length) + " registros", 38);
      const line6 = padLine("TAXA DE REPASSE", split + "% Clã / " + (100 - split) + "% Mem", 38);

      const moldura = [
        "╔══════════════════════════════════════════╗",
        "║          PAINEL OPERACIONAL - HQ         ║",
        "╠══════════════════════════════════════════╣",
        "║  " + line1 + "  ║",
        "║  " + line2 + "  ║",
        "║  " + line3 + "  ║",
        "╠══════════════════════════════════════════╣",
        "║  " + line4 + "  ║",
        "║  " + line5 + "  ║",
        "║  " + line6 + "  ║",
        "╚══════════════════════════════════════════╝"
      ].join("\n");

      const embed = new EmbedBuilder()
        .setTitle("🐺 HUNTERS — PAINEL OPERACIONAL")
        .setColor("#9333EA")
        .setDescription("### 📊 Status de Recursos e Operação do Clã (Persistência JSON)\n\n```text\n" + moldura + "\n```")
        .setFooter({ text: "Hunters Management v3.5 | JSON DB + Backup", iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_estoque').setLabel('Estoque 📦').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_caixa').setLabel('Caixa 🏦').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('btn_ranking').setLabel('Ranking 🏆').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_nova_venda').setLabel('Registrar Venda 🛒').setStyle(ButtonStyle.Danger)
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

      // Normalização e Busca Inteligente por Aproximação (Fuzzy Match)
      const inputNormalizado = itemArg.toLowerCase().replace(/[^a-z0-9]/g, '');
      let itemKey = Object.keys(ITENS_DB).find(k => k === inputNormalizado);
      
      if (!itemKey) {
        itemKey = Object.keys(ITENS_DB).find(k => k.includes(inputNormalizado) || inputNormalizado.includes(k));
      }

      const item = itemKey ? ITENS_DB[itemKey] : null;
      if (!item) {
        return message.reply(`❌ **Item não encontrado!** Opções válidas: \`${Object.keys(ITENS_DB).join(", ")}\``);
      }

      const qty = parseInt(qtdArg);
      if (isNaN(qty) || qty <= 0) {
        return message.reply("❌ **Erro:** A quantidade deve ser um número inteiro maior que zero.");
      }

      const aplicarDesconto = descArg === '--desconto';
      let precoUnitario = item.value;
      if (aplicarDesconto) {
        precoUnitario = precoUnitario * 0.9; // 10% de desconto
      }

      const acoConsumido = item.steel * qty;
      const faturamentoBruto = precoUnitario * qty;

      if (localData.estoque < acoConsumido) {
        return message.reply(`❌ **Estoque insuficiente!** Exige **${formatNumber(acoConsumido)} kg**, restam apenas **${formatNumber(localData.estoque)} kg**.`);
      }

      const split = localData.settings.clanSplitPercent || 70;
      const valorCla = Math.floor(faturamentoBruto * (split / 100));
      const valorMembro = Math.floor(faturamentoBruto * ((100 - split) / 100));

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
      writeLog(localData, message.author, "REGISTRO_VENDA", `Venda de ${qty}x ${item.name} por ${formatMoney(faturamentoBruto)}`);
      saveDatabase(localData);

      const embed = new EmbedBuilder()
        .setTitle("✅ VENDA REGISTRADA COM SUCESSO!")
        .setColor("#10B981")
        .setDescription(`👤 Vendedor: <@${message.author.id}>\n🔫 Equipamento: **${item.name}** (${qty}x)\n🛠️ Aço consumido: **${formatNumber(acoConsumido)} kg**${aplicarDesconto ? ' \n⚠️ *(10% de desconto aplicado)*' : ''}`)
        .addFields(
          { name: "💰 Faturamento Bruto", value: `**${formatMoney(faturamentoBruto)}**`, inline: true },
          { name: "🏦 Entrada no Caixa (" + split + "%)", value: `**${formatMoney(valorCla)}**`, inline: true },
          { name: "💸 Comissão Membro (" + (100 - split) + "%)", value: `**${formatMoney(valorMembro)}**`, inline: true }
        )
        .setFooter({ text: "Venda gravada no banco JSON com segurança." })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // COMANDO: !addaco <quantidade>
    if (command === 'addaco') {
      if (!hasAdminPermission(message)) {
        return message.reply("❌ **Permissão Negada:** Apenas administradores do clã podem alterar o estoque.");
      }

      const qty = parseInt(args[0]);
      if (isNaN(qty) || qty <= 0) {
        return message.reply("⚠️ **Uso correto:** `!addaco <quantidade>`");
      }

      localData.estoque += qty;
      writeLog(localData, message.author, "ADICIONAR_ACO", `Adicionados +${qty} kg ao estoque`);
      saveDatabase(localData);

      return message.reply(`✅ **Estoque Abastecido:** Adicionados **${formatNumber(qty)} kg** de aço. Total: **${formatNumber(localData.estoque)} kg**.`);
    }

    // COMANDO: !remaco <quantidade>
    if (command === 'remaco') {
      if (!hasAdminPermission(message)) {
        return message.reply("❌ **Permissão Negada.**");
      }

      const qty = parseInt(args[0]);
      if (isNaN(qty) || qty <= 0) {
        return message.reply("⚠️ **Uso correto:** `!remaco <quantidade>`");
      }

      if (localData.estoque < qty) {
        return message.reply(`❌ **Estoque insuficiente!** Restam apenas **${formatNumber(localData.estoque)} kg**.`);
      }

      localData.estoque -= qty;
      writeLog(localData, message.author, "REMOVER_ACO", `Removidos -${qty} kg do estoque`);
      saveDatabase(localData);

      return message.reply(`✅ **Estoque Reduzido:** Removidos **${formatNumber(qty)} kg** de aço. Total: **${formatNumber(localData.estoque)} kg**.`);
    }

    // COMANDO: !addcaixa <valor>
    if (command === 'addcaixa') {
      if (!hasAdminPermission(message)) {
        return message.reply("❌ **Permissão Negada.**");
      }

      const qty = parseInt(args[0]);
      if (isNaN(qty) || qty <= 0) {
        return message.reply("⚠️ **Uso correto:** `!addcaixa <valor_reais>`");
      }

      localData.caixa += qty;
      writeLog(localData, message.author, "ADICIONAR_CAIXA", `Depósito de ${formatMoney(qty)} no caixa`);
      saveDatabase(localData);

      return message.reply(`✅ **Caixa Abastecido:** Depositados **${formatMoney(qty)}**. Novo saldo: **${formatMoney(localData.caixa)}**.`);
    }

    // COMANDO: !remcaixa <valor>
    if (command === 'remcaixa') {
      if (!hasAdminPermission(message)) {
        return message.reply("❌ **Permissão Negada.**");
      }

      const qty = parseInt(args[0]);
      if (isNaN(qty) || qty <= 0) {
        return message.reply("⚠️ **Uso correto:** `!remcaixa <valor_reais>`");
      }

      if (localData.caixa < qty) {
        return message.reply(`❌ **Saldo insuficiente!** Resta apenas **${formatMoney(localData.caixa)}**.`);
      }

      localData.caixa -= qty;
      writeLog(localData, message.author, "REMOVER_CAIXA", `Retirada de ${formatMoney(qty)} do caixa`);
      saveDatabase(localData);

      return message.reply(`✅ **Retirada Efetuada:** Sacados **${formatMoney(qty)}**. Novo saldo: **${formatMoney(localData.caixa)}**.`);
    }

    // COMANDO ADMINISTRATIVO: !setsplit <porcentagem>
    if (command === 'setsplit') {
      if (!hasAdminPermission(message)) {
        return message.reply("❌ **Permissão Negada.**");
      }

      const percent = parseInt(args[0]);
      if (isNaN(percent) || percent < 0 || percent > 100) {
        return message.reply("⚠️ **Uso correto:** `!setsplit <porcentagem>` (ex: 70)");
      }

      localData.settings.clanSplitPercent = percent;
      writeLog(localData, message.author, "CONFIG_SPLIT", `Alterada divisão para ${percent}% Clã`);
      saveDatabase(localData);

      return message.reply(`✅ **Divisão Atualizada:** Configurada para **${percent}% Clã / ${100 - percent}% Membro**.`);
    }

    // COMANDO ADMINISTRATIVO: !config
    if (command === 'config') {
      const split = localData.settings.clanSplitPercent || 70;
      const kit = localData.settings.kitCost || 5000;
      const reserve = localData.settings.steelClanPercent || 10;

      const embed = new EmbedBuilder()
        .setTitle("⚙️ CONFIGURAÇÕES DA FACÇÃO")
        .setColor("#6366F1")
        .addFields(
          { name: "⚖️ Repasse de Comissões", value: `**${split}% Clã / ${100 - split}% Membro**`, inline: true },
          { name: "📦 Custo do Kit Pronto", value: `**${formatNumber(kit)} kg de aço**`, inline: true },
          { name: "🛡️ Reserva Estratégica", value: `**${reserve}% do Estoque**`, inline: true }
        )
        .setFooter({ text: "Use !setsplit, !setkit ou !setclanpercent para ajustar parâmetros." })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
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
        return message.reply("❌ **Permissão Negada.**");
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
          { name: "📊 `!painel`", value: "Exibe o painel de recursos moldurado com botões interativos." },
          { name: "🛒 `!venda <item> <qtd> [--desconto]`", value: "Registra venda, rateia faturamento e debita o aço." },
          { name: "🏆 `!ranking`", value: "Ranking de desempenho dos vendedores." },
          { name: "⚙️ `!config`", value: "Mostra parâmetros atuais da facção." }
        )
        .setFooter({ text: "Hunters Management v3.5 | JSON DB" })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }
  } catch (cmdError) {
    console.error("⚠️ Erro ao executar comando:", cmdError);
  }
});

// Suporte aos Botões Interativos
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const localData = loadDatabase();

  try {
    if (interaction.customId === 'btn_estoque') {
      const clanAco = Math.floor(localData.estoque * (localData.settings.steelClanPercent / 100));
      return interaction.reply({
        content: `📦 **ESTOQUE GERAL:** ${formatNumber(localData.estoque)} kg de Aço\n🛡️ **Reserva Estratégica do Clã:** ${formatNumber(clanAco)} kg`,
        ephemeral: true
      });
    }

    if (interaction.customId === 'btn_caixa') {
      return interaction.reply({
        content: `🏦 **SALDO ATUAL DO CAIXA:** ${formatMoney(localData.caixa)} (Destinado à expansão e base)`,
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

    // NOVO RECURSO TOP: Botão de registro e ajuda de venda rápido
    if (interaction.customId === 'btn_nova_venda') {
      const split = localData.settings.clanSplitPercent || 70;
      let itemsList = "";
      Object.entries(ITENS_DB).forEach(([key, item]) => {
        itemsList += `• **${key}** : ${item.name} | Custo: ${formatNumber(item.steel)} kg | Valor: ${formatMoney(item.value)}\n`;
      });

      const embed = new EmbedBuilder()
        .setTitle("🛒 REGISTRO RÁPIDO DE VENDA - HUNTERS")
        .setColor("#EF4444")
        .setDescription(`Para lançar uma nova venda, utilize o comando abaixo no chat público:\n\n**\`\`\`text\n!venda <item> <quantidade> [--desconto]\n\`\`\`**\n💡 *Exemplo: \`!venda ak47 2\` ou \`!venda m16 5 --desconto\`*\n\n📋 **TABELA DE CÓDIGOS E VALORES:**\n${itemsList}\n⚖️ **RATEIO FINANCEIRO ATUAL:**\n• **${split}%** destinado ao Caixa do Clã\n• **${100 - split}%** de Comissão para o Vendedor`)
        .setFooter({ text: "Sindicato de Armas Hunters | ERP Sinc" })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } catch (btnError) {
    console.error("⚠️ Erro na interação:", btnError);
    try {
      return interaction.reply({ content: "❌ Erro ao processar esta interação.", ephemeral: true });
    } catch (_) {}
  }
});

// Tratamento de Erros Globais para prevenir queda do Bot (Resiliência 24/7)
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [Hunters Bot] Rejeição não tratada em:', promise, 'motivo:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('⚠️ [Hunters Bot] Erro não tratado capturado:', error);
});

client.login(DISCORD_TOKEN);
