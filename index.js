/**
 * 🐺 HUNTERS BOT - STANDALONE SCRIPT v3.5 🐺
 * Desenvolvido para o clã/facção HUNTERS.
 * 
 * 🚀 VERSÃO STANDALONE (100% OFFLINE - COM BANCO DE DADOS LOCAL JSON)
 * Gerencie estoque, vendas, caixa, comissões, ranking e logs diretamente pelo Discord.
 * Suporta persistência permanente de dados em um arquivo 'database.json'.
 * Totalmente compatível com Node.js 18+ e pronto para Railway / VPS!
 */

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DISCORD_TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID; // ID do cargo administrativo opcional do .env
const DB_FILE = path.join(__dirname, 'database.json');
const BACKUP_FILE = path.join(__dirname, 'database_backup.json');

if (!DISCORD_TOKEN) {
  console.error("❌ ERRO: O token do bot (DISCORD_TOKEN ou TOKEN) não foi configurado no arquivo .env!");
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
    estoque: 740000// 150 mil kg de aço iniciais
    caixa: 0,   // R$ 1.500.000,00 iniciais
    vendas: [],
    logs: [],
    settings: {
      kitCost: 8000,
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
        console.log("♻️ Recuperação emergencial concluída com sucesso!");
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
===============================================
`);
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
          itemsList += `• **${key}**: ${item.name} | Custo: ${formatNumber(item.steel)} kg de aço | Valor: ${formatMoney(item.value)}\n`;
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
        // Busca parcial inteligente (Ex: "ak" acha "ak47", "glock" acha "glock17", "556" acha "box556")
        itemKey = Object.keys(ITENS_DB).find(k => k.includes(inputNormalizado) || inputNormalizado.includes(k));
      }

      const item = itemKey ? ITENS_DB[itemKey] : null;
      if (!item) {
        return message.reply(`❌ **Item não encontrado!** Código digitado: \`${itemArg}\`. Opções válidas: \`${Object.keys(ITENS_DB).join(", ")}\` ou consulte \`!venda itens\``);
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

      // Calcula divisões baseadas nas configurações carregadas
      const split = localData.settings.clanSplitPercent || 70;
      const valorCla = Math.floor(faturamentoBruto * (split / 100));
      const valorMembro = Math.floor(faturamentoBruto * ((100 - split) / 100));

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
          { name: "🏦 Entrada no Caixa (" + split + "%)", value: `**${formatMoney(valorCla)}**`, inline: true },
          { name: "💸 Comissão Membro (" + (100 - split) + "%)", value: `**${formatMoney(valorMembro)}**`, inline: true }
        )
        .setFooter({ text: "Venda gravada com sucesso no banco de dados JSON persistente." })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // COMANDO: !addaco <quantidade>
    if (command === 'addaco') {
      if (!hasAdminPermission(message)) {
        return message.reply("❌ **Permissão Negada:** Apenas administradores ou membros autorizados podem abastecer o estoque.");
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
        return message.reply("❌ **Permissão Negada:** Apenas administradores ou membros autorizados podem debitar do estoque.");
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
        return message.reply("❌ **Permissão Negada:** Apenas administradores ou membros autorizados podem depositar fundos.");
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
        return message.reply("❌ **Permissão Negada:** Apenas administradores ou membros autorizados podem sacar do caixa.");
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

    // COMANDO ADMINISTRATIVO: !setsplit <porcentagem>
    if (command === 'setsplit') {
      if (!hasAdminPermission(message)) {
        return message.reply("❌ **Permissão Negada:** Apenas administradores podem alterar a divisão.");
      }

      const percent = parseInt(args[0]);
      if (isNaN(percent) || percent < 0 || percent > 100) {
        return message.reply("⚠️ **Uso correto:** `!setsplit <porcentagem_cla>`\nExemplo: `!setsplit 70` (70% para o clã, 30% comissão para membro)");
      }

      localData.settings.clanSplitPercent = percent;
      writeLog(localData, message.author, "CONFIG_SPLIT", `Alterada divisão de comissão para ${percent}% Clã`);
      saveDatabase(localData);

      return message.reply(`✅ **Configuração Atualizada:** Divisão de comissão definida para **${percent}% Clã / ${100 - percent}% Membro**.`);
    }

    // COMANDO ADMINISTRATIVO: !setkit <custo_kg>
    if (command === 'setkit') {
      if (!hasAdminPermission(message)) {
        return message.reply("❌ **Permissão Negada:** Apenas administradores podem alterar o custo de kits.");
      }

      const cost = parseInt(args[0]);
      if (isNaN(cost) || cost <= 0) {
        return message.reply("⚠️ **Uso correto:** `!setkit <custo_kg>`\nExemplo: `!setkit 5000` (Equivale a 5 toneladas de aço por kit pronto)");
      }

      localData.settings.kitCost = cost;
      writeLog(localData, message.author, "CONFIG_KIT_COST", `Alterado custo por kit pronto para ${cost} kg`);
      saveDatabase(localData);

      return message.reply(`✅ **Configuração Atualizada:** Cada kit pronto agora equivale a **${formatNumber(cost)} kg** de aço.`);
    }

    // COMANDO ADMINISTRATIVO: !setclanpercent <porcentagem>
    if (command === 'setclanpercent') {
      if (!hasAdminPermission(message)) {
        return message.reply("❌ **Permissão Negada:** Apenas administradores podem alterar a reserva estratégica.");
      }

      const percent = parseInt(args[0]);
      if (isNaN(percent) || percent < 0 || percent > 100) {
        return message.reply("⚠️ **Uso correto:** `!setclanpercent <porcentagem>`\nExemplo: `!setclanpercent 10` (Reserva estratégica do clã fixa em 10% do estoque)");
      }

      localData.settings.steelClanPercent = percent;
      writeLog(localData, message.author, "CONFIG_CLAN_PERCENT", `Alterada porcentagem de reserva estratégica para ${percent}%`);
      saveDatabase(localData);

      return message.reply(`✅ **Configuração Atualizada:** Reserva estratégica do clã definida para **${percent}%** do estoque total.`);
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
        return message.reply("❌ **Permissão Negada:** Apenas administradores ou membros autorizados podem ver os logs operacionais.");
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
          { name: "🛒 `!venda <item> <qtd> [--desconto]`", value: "Registra uma venda, calcula o rateio e debita o aço do estoque (Possui busca inteligente/aproximada!)." },
          { name: "🔫 `!venda itens`", value: "Mostra a tabela de todos os itens cadastrados com custos e valores." },
          { name: "🏆 `!ranking`", value: "Mostra o ranking de desempenho dos melhores vendedores." },
          { name: "⚙️ `!config`", value: "Mostra os parâmetros operacionais atuais do clã (comissões, kit, etc.)." },
          { name: "📜 `!logs`", value: "Mostra o histórico das últimas 10 ações de controle (Apenas Admins)." },
          { name: "📦 `!addaco <qtd>` / `!remaco <qtd>`", value: "Adiciona ou remove aço do estoque geral (Apenas Admins)." },
          { name: "🏦 `!addcaixa <valor>` / `!remcaixa <valor>`", value: "Realiza depósitos ou saques diretos no caixa do clã (Apenas Admins)." },
          { name: "🛠️ Comandos de Configuração (Admins)", value: "• `!setsplit <porcentagem>`: Define repasse ao clã (ex: 70)\n• `!setkit <kg>`: Define peso do kit pronto (ex: 5000)\n• `!setclanpercent <%>`: Define reserva estratégica (ex: 10)" }
        )
        .setFooter({ text: "Hunters Management v3.5 | JSON DB" })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }
  } catch (cmdError) {
    console.error("⚠️ Erro ao executar comando " + command + ":", cmdError);
    try {
      return message.reply("⚠️ **Erro Interno:** Ocorreu um erro ao processar o comando. Ação cancelada com segurança.");
    } catch (_) {}
  }
});

// Suporte a botões interativos
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  // Carrega dados atualizados para cliques em botões
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
  } catch (btnError) {
    console.error("⚠️ Erro na interação do botão:", btnError);
    try {
      return interaction.reply({ content: "❌ Ocorreu um erro ao processar esta interação.", ephemeral: true });
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
