// ====================================================================
//                    🐺 HUNTERS BOT v2.4 🐺
// ====================================================================

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
  ActivityType
} = require('discord.js');

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ====================================================================
// CLIENT CONFIGURATION
// ====================================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ====================================================================
// CONFIGURAÇÕES GERAIS
// ====================================================================

const PREFIX = process.env.PREFIX || '!';
const KIT_COST = 3760;
const GERENTE_ROLE_ID = '1523277774436171796';
const CANAL_LOG_VENDAS_ID = '1525698045537161226';

const DB_PATH = path.join(__dirname, 'database', 'database.json');

// ====================================================================
// BANCO DE DADOS DE ITENS (CUSTOS EM AÇO E VALORES DE MERCADO)
// ====================================================================

const itensDb = {
  ak47: { name: 'AK-47', steel: 2700, value: 35000 },
  awp: { name: 'AWP', steel: 3000, value: 65000 },
  m16: { name: 'M16', steel: 2700, value: 35000 },
  sawedoff: { name: 'Sawed-Off Shotgun', steel: 1200, value: 20000 },
  glock17: { name: 'Glock 17', steel: 120, value: 5000 },
  tec9: { name: 'TEC-9', steel: 900, value: 15000 },
  taser: { name: 'Taser', steel: 700, value: 10000 },
  box556: { name: 'Box M. 5.56', steel: 120, value: 5000 },
  box308: { name: 'Box M. .308', steel: 200, value: 5000 }
};

// ====================================================================
// SISTEMA DE PERSISTÊNCIA (JSON DATABASE)
// ====================================================================

function verificarDatabase() {
  const pasta = path.dirname(DB_PATH);
  if (!fs.existsSync(pasta)) {
    fs.mkdirSync(pasta, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify(
        {
          estoque: 0,
          caixa: 0,
          vendas: []
        },
        null,
        2
      )
    );
  }
}

function carregarDb() {
  verificarDatabase();
  try {
    const conteudo = fs.readFileSync(DB_PATH, 'utf8');
    const db = JSON.parse(conteudo);

    // Normalizações de segurança
    if (typeof db.estoque !== 'number') db.estoque = 0;
    if (typeof db.caixa !== 'number') db.caixa = 0;
    if (!Array.isArray(db.vendas)) db.vendas = [];

    return db;
  } catch (error) {
    console.error('❌ Erro ao carregar database:', error);
    return { estoque: 0, caixa: 0, vendas: [] };
  }
}

function salvarDb(db) {
  verificarDatabase();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// ====================================================================
// HELPER FUNCTIONS
// ====================================================================

function numero(valor) {
  return Number(valor || 0).toLocaleString('pt-BR');
}

function dinheiro(valor) {
  return `R$ ${numero(valor)}`;
}

function normalizar(texto) {
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function buscarItem(nome) {
  const busca = normalizar(nome);
  if (!busca) return null;

  for (const [key, item] of Object.entries(itensDb)) {
    if (
      normalizar(key) === busca ||
      normalizar(item.name) === busca ||
      normalizar(item.name).includes(busca)
    ) {
      return item;
    }
  }
  return null;
}

function podeAlterarEstoque(interaction) {
  return interaction.member?.roles?.cache?.has(GERENTE_ROLE_ID);
}

function erroPermissao() {
  return {
    content: '🚫 **ACESSO NEGADO!**\n\n🐺 Somente membros com o cargo **Gerentes** podem gerenciar o estoque.',
    ephemeral: true
  };
}

// ====================================================================
// RENDERIZADOR DO PAINEL PRINCIPAL
// ====================================================================

function criarPainel() {
  const db = carregarDb();
  const kits = Math.floor(db.estoque / KIT_COST);
  const totalVendas = db.vendas.reduce((total, venda) => total + Number(venda.total || 0), 0);

  const embed = new EmbedBuilder()
    .setTitle('🐺 HUNTERS BOT — PAINEL CENTRAL')
    .setColor('#8B5CF6')
    .setDescription('## 🐺 SISTEMA DE GESTÃO HUNTERS\nControle oficial de estoque, caixa e vendas para operações táticas.')
    .addFields(
      { name: '🛠️ Estoque de Aço', value: `**${numero(db.estoque)} Aços**`, inline: true },
      { name: '💰 Caixa HUNTERS', value: `**${dinheiro(db.caixa)}**`, inline: true },
      { name: '🎁 Capacidade de Kits', value: `**${numero(kits)} Kits**`, inline: true },
      { name: '🛒 Total Vendido', value: `**${dinheiro(totalVendas)}**`, inline: true },
      { name: '📜 Vendas Registradas', value: `**${numero(db.vendas.length)} vendas**`, inline: true },
      { name: '📊 Divisão de Lucros', value: '**🏦 70% Clã | 💵 30% Membro**', inline: true }
    )
    .setFooter({ text: 'HUNTERS BOT v2.4 🐺' })
    .setTimestamp();

  const linha1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('estoque').setLabel('Estoque').setEmoji('📦').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('adicionar_aco').setLabel('Adicionar Aço').setEmoji('➕').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('retirar_aco').setLabel('Retirar Aço').setEmoji('➖').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('kits').setLabel('Kits').setEmoji('🎁').setStyle(ButtonStyle.Secondary)
  );

  const linha2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('registrar_venda').setLabel('Registrar Venda').setEmoji('💰').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('caixa').setLabel('Caixa').setEmoji('🏦').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ranking').setLabel('Ranking').setEmoji('🏆').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('historico').setLabel('Histórico').setEmoji('📜').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [linha1, linha2] };
}

// ====================================================================
// EVENTO: BOT ONLINE
// ====================================================================

client.once('ready', () => {
  verificarDatabase();
  console.log('===================================');
  console.log('🐺 HUNTERS BOT v2.4 ONLINE');
  console.log(`🤖 Logado como: ${client.user.tag}`);
  console.log('===================================');

  client.user.setActivity('Gestão HUNTERS 🐺', { type: ActivityType.Watching });
});

// ====================================================================
// EVENTO: COMANDOS CHAT (!painel, !estoque, !caixa)
// ====================================================================

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();

  if (command === 'painel') {
    return message.channel.send(criarPainel());
  }

  if (command === 'estoque') {
    const db = carregarDb();
    return message.reply(`📦 Estoque atual: **${numero(db.estoque)} Aços**`);
  }

  if (command === 'caixa') {
    const db = carregarDb();
    return message.reply(`🏦 Caixa HUNTERS: **${dinheiro(db.caixa)}**`);
  }
});

// ====================================================================
// EVENTO: INTEGRAÇÕES DE BOTÕES E SUBMISSÕES
// ====================================================================

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton()) {
      const db = carregarDb();

      // Botão: Visualizar Estoque
      if (interaction.customId === 'estoque') {
        const clanAco = Math.floor(db.estoque * 0.6);
        const vendaAco = db.estoque - clanAco;
        const kits = Math.floor(clanAco / KIT_COST);

        const embed = new EmbedBuilder()
          .setTitle('📦 ESTOQUE HUNTERS')
          .setColor('#3B82F6')
          .addFields(
            { name: '💎 Estoque Total', value: `**${numero(db.estoque)} Aços**` },
            { name: '🐺 60% Clã (Kits)', value: `${numero(clanAco)} Aços`, inline: true },
            { name: '💰 40% Venda', value: `${numero(vendaAco)} Aços`, inline: true },
            { name: '🎁 Kits Completos Disponíveis', value: `**${numero(kits)} Kits**` }
          )
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Botão: Visualizar Caixa Financeiro
      if (interaction.customId === 'caixa') {
        const totalVendido = db.vendas.reduce((acc, v) => acc + Number(v.total || 0), 0);
        const totalMembros = db.vendas.reduce((acc, v) => acc + Number(v.membro || 0), 0);

        const embed = new EmbedBuilder()
          .setTitle('🏦 CAIXA HUNTERS')
          .setColor('#22C55E')
          .setDescription('🐺 **Controle financeiro oficial da organização.**')
          .addFields(
            { name: '🏦 Saldo em Caixa (70%)', value: `**${dinheiro(db.caixa)}**` },
            { name: '💰 Total Movimentado', value: dinheiro(totalVendido), inline: true },
            { name: '👤 Comissão Membros (30%)', value: dinheiro(totalMembros), inline: true },
            { name: '📊 Regra de Divisão', value: '70% Destinado ao Caixa Geral do Clã\n30% Pago diretamente ao Vendedor' }
          )
          .setFooter({ text: 'HUNTERS Financeiro' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Botão: Adicionar Aço (Apenas Gerentes)
      if (interaction.customId === 'adicionar_aco') {
        if (!podeAlterarEstoque(interaction)) return interaction.reply(erroPermissao());

        const modal = new ModalBuilder().setCustomId('modal_adicionar_aco').setTitle('Adicionar Aço ao Estoque');
        const input = new TextInputBuilder()
          .setCustomId('quantidade')
          .setLabel('Quantidade de Aço (KG)')
          .setPlaceholder('Exemplo: 5000')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      // Botão: Retirar Aço (Apenas Gerentes)
      if (interaction.customId === 'retirar_aco') {
        if (!podeAlterarEstoque(interaction)) return interaction.reply(erroPermissao());

        const modal = new ModalBuilder().setCustomId('modal_retirar_aco').setTitle('Retirar Aço do Estoque');
        const input = new TextInputBuilder()
          .setCustomId('quantidade')
          .setLabel('Quantidade de Aço (KG)')
          .setPlaceholder('Exemplo: 3760')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      // Botão: Informações de Kits
      if (interaction.customId === 'kits') {
        const kits = Math.floor(db.estoque / KIT_COST);
        const sobra = db.estoque % KIT_COST;

        const embed = new EmbedBuilder()
          .setTitle('🎁 CALCULADORA DE KITS')
          .setColor('#8B5CF6')
          .setDescription(
            'Composição de cada Kit:\n' +
            '⚡ **1x Taser**\n' +
            '🔫 **1x AK-47**\n' +
            '📦 **3x Box M. 5.56**\n\n' +
            `💎 Custo de fabricação: **${numero(KIT_COST)} Aços**`
          )
          .addFields(
            { name: '🎁 Kits Produzíveis', value: `**${numero(kits)} Kits**`, inline: true },
            { name: '📦 Sobra do Estoque', value: `**${numero(sobra)} Aços**`, inline: true }
          );

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Botão: Registrar Nova Venda
      if (interaction.customId === 'registrar_venda') {
        const modal = new ModalBuilder().setCustomId('modal_venda').setTitle('Registrar Nova Venda');

        const item = new TextInputBuilder()
          .setCustomId('item')
          .setLabel('Item Fabricado')
          .setPlaceholder('Exemplo: AK-47, AWP, Taser')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const quantidade = new TextInputBuilder()
          .setCustomId('quantidade')
          .setLabel('Quantidade')
          .setPlaceholder('Exemplo: 2')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const desconto = new TextInputBuilder()
          .setCustomId('desconto')
          .setLabel('Aplicar Desconto de 15%? (sim / nao)')
          .setPlaceholder('nao')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(item),
          new ActionRowBuilder().addComponents(quantidade),
          new ActionRowBuilder().addComponents(desconto)
        );

        return interaction.showModal(modal);
      }

      // Botão: Histórico das Últimas Vendas
      if (interaction.customId === 'historico') {
        const vendas = db.vendas.slice(-8).reverse();
        let texto = '';

        vendas.forEach((v) => {
          texto += `👤 <@${v.userId}>\n🔫 ${v.quantidade}x ${v.item}\n💰 Total: ${dinheiro(v.total)} (Clã: ${dinheiro(v.cla)} | Vendedor: ${dinheiro(v.membro)})\n📅 ${v.data}\n\n`;
        });

        if (!texto) texto = 'Nenhuma venda registrada até o momento.';

        const embed = new EmbedBuilder()
          .setTitle('📜 HISTÓRICO DE ÚLTIMAS TRANSAÇÕES')
          .setColor('#EC4899')
          .setDescription(texto)
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Botão: Ranking de Vendedores
      if (interaction.customId === 'ranking') {
        const ranking = {};

        db.vendas.forEach((v) => {
          if (!ranking[v.userId]) {
            ranking[v.userId] = { total: 0, membro: 0, vendas: 0 };
          }
          ranking[v.userId].total += Number(v.total || 0);
          ranking[v.userId].membro += Number(v.membro || 0);
          ranking[v.userId].vendas++;
        });

        const resultado = Object.entries(ranking)
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 10);

        let texto = '';
        resultado.forEach(([userId, dados], index) => {
          texto += `**${index + 1}º** <@${userId}>\n💰 Volume: ${dinheiro(dados.total)} | Comissão: ${dinheiro(dados.membro)}\n📜 ${dados.vendas} vendas registradas\n\n`;
        });

        if (!texto) texto = 'Nenhuma venda encontrada para gerar ranking.';

        const embed = new EmbedBuilder()
          .setTitle('🏆 RANKING DE LIDERANÇA — HUNTERS')
          .setColor('#F59E0B')
          .setDescription(texto)
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    // ==============================================================
    // TRATAMENTO DAS SUBMISSÕES DE MODAIS (MODAL SUBMIT)
    // ==============================================================

    if (interaction.isModalSubmit()) {
      const db = carregarDb();

      // Submit: Adicionar Aço
      if (interaction.customId === 'modal_adicionar_aco') {
        const quantidade = Number(interaction.fields.getTextInputValue('quantidade'));

        if (isNaN(quantidade) || quantidade <= 0 || !Number.isInteger(quantidade)) {
          return interaction.reply({ content: '❌ Por favor, insira uma quantidade inteira válida.', ephemeral: true });
        }

        db.estoque += quantidade;
        salvarDb(db);

        return interaction.reply({
          content: `✅ **Sucesso!** Adicionado **${numero(quantidade)} kg** de aço ao estoque.\n📦 Estoque atualizado: **${numero(db.estoque)} kg**`,
          ephemeral: true
        });
      }

      // Submit: Retirar Aço
      if (interaction.customId === 'modal_retirar_aco') {
        const quantidade = Number(interaction.fields.getTextInputValue('quantidade'));

        if (isNaN(quantidade) || quantidade <= 0 || !Number.isInteger(quantidade)) {
          return interaction.reply({ content: '❌ Por favor, insira uma quantidade inteira válida.', ephemeral: true });
        }

        if (quantidade > db.estoque) {
          return interaction.reply({ content: `❌ Retirada negada! Estoque insuficiente (Disponível: ${numero(db.estoque)} kg).`, ephemeral: true });
        }

        db.estoque -= quantity;
        salvarDb(db);

        return interaction.reply({
          content: `➖ **Sucesso!** Retirado **${numero(quantidade)} kg** de aço do estoque.\n📦 Estoque atualizado: **${numero(db.estoque)} kg**`,
          ephemeral: true
        });
      }

      // Submit: Registrar Venda
      if (interaction.customId === 'modal_venda') {
        const nomeItem = interaction.fields.getTextInputValue('item');
        const quantidade = Number(interaction.fields.getTextInputValue('quantidade'));
        const respostaDesconto = interaction.fields.getTextInputValue('desconto').trim().toLowerCase();

        const item = buscarItem(nomeItem);
        if (!item) {
          return interaction.reply({ content: `❌ Erro! Item **${nomeItem}** não catalogado na fábrica de armas Hunters.`, ephemeral: true });
        }

        if (isNaN(quantidade) || quantidade <= 0 || !Number.isInteger(quantidade)) {
          return interaction.reply({ content: '❌ Quantidade inválida.', ephemeral: true });
        }

        const acoNecessario = item.steel * quantidade;
        if (acoNecessario > db.estoque) {
          return interaction.reply({
            content: `❌ **AÇO INSUFICIENTE!**\nRequer: **${numero(acoNecessario)} kg** | Estoque: **${numero(db.estoque)} kg**`,
            ephemeral: true
          });
        }

        const aplicarDesconto = respostaDesconto === 'sim' || respostaDesconto === 's';
        const valorUnitario = aplicarDesconto ? Math.round(item.value * 0.85) : item.value;
        const total = valorUnitario * quantidade;

        // Divisão de lucros: 70% Clã, 30% Membro
        const cla = Math.round(total * 0.7);
        const membro = total - cla;

        // Atualiza banco de dados
        db.estoque -= acoNecessario;
        db.caixa += cla;

        const novaVenda = {
          id: Date.now(),
          userId: interaction.user.id,
          userName: interaction.user.username,
          item: item.name,
          quantidade,
          valorUnitario,
          total,
          cla,
          membro,
          aco: acoNecessario,
          desconto: aplicarDesconto,
          data: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        };

        db.vendas.push(novaVenda);
        salvarDb(db);

        // Disparar Webhook de logs para o canal correspondente
        const embedLog = new EmbedBuilder()
          .setTitle('💰 NOVA VENDA REGISTRADA — HUNTERS')
          .setColor('#22C55E')
          .setThumbnail(interaction.user.displayAvatarURL())
          .setDescription('🐺 **Uma nova manufatura e comercialização foi homologada.**')
          .addFields(
            { name: '👤 Vendedor', value: `<@${interaction.user.id}> (${interaction.user.username})` },
            { name: '🔫 Armamento', value: `${item.name}`, inline: true },
            { name: '📦 Quantidade', value: `${numero(quantidade)}x`, inline: true },
            { name: '🛠️ Aço Consumido', value: `${numero(acoNecessario)} kg`, inline: true },
            { name: '💰 Total Arrecadado', value: `**${dinheiro(total)}**` },
            { name: '🏦 Entrada Clã (70%)', value: `**${dinheiro(cla)}**`, inline: true },
            { name: '💵 Comissão Membro (30%)', value: `**${dinheiro(membro)}**`, inline: true },
            { name: '📦 Saldo de Estoque Restante', value: `**${numero(db.estoque)} kg de Aço**` }
          )
          .setFooter({ text: `Hunters Bot • ID ${novaVenda.id}` })
          .setTimestamp();

        try {
          const canalLog = await client.channels.fetch(CANAL_LOG_VENDAS_ID);
          if (canalLog && canalLog.isTextBased()) {
            await canalLog.send({ embeds: [embedLog] });
          }
        } catch (webhookError) {
          console.error('❌ Erro ao enviar log para canal do Discord:', webhookError);
        }

        return interaction.reply({
          content:
            `✅ **VENDA REGISTRADA COM SUCESSO!**\n\n` +
            `💰 Valor Bruto: **${dinheiro(total)}**\n` +
            `🏦 Comissão Clã (70%): **${dinheiro(cla)}** (Transferido ao Caixa)\n` +
            `💵 Sua Comissão (30%): **${dinheiro(membro)}**\n` +
            `🛠️ Aço Debitado: **${numero(acoNecessario)} kg**`,
          ephemeral: true
        });
      }
    }
  } catch (error) {
    console.error('❌ Ocorreu um erro na interação:', error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Ocorreu um erro ao processar esta ação.', ephemeral: true });
    }
  }
});

// ====================================================================
// TRATAMENTO DE EXCEÇÕES DO PROCESSO
// ====================================================================

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Promise Rejection:', error);
});

// Inicialização segura
if (!process.env.TOKEN) {
  console.error('❌ Erro crítico: Variável TOKEN não configurada no arquivo .env!');
  process.exit(1);
}

client.login(process.env.TOKEN);
