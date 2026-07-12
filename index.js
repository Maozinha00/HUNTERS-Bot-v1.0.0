// ====================================================================
//                    🐺 HUNTERS BOT v2.1 🐺
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
// CLIENT
// ====================================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ====================================================================
// CONFIGURAÇÕES
// ====================================================================

const PREFIX = process.env.PREFIX || '!';

const KIT_COST = 3760;

// CARGO GERENTES
const GERENTE_ROLE_ID = '1523277774436171796';

const DB_PATH = path.join(
  __dirname,
  'database',
  'database.json'
);

// ====================================================================
// ITENS
// ====================================================================

const itensDb = {
  ak47: {
    name: 'AK-47',
    steel: 2700,
    value: 35000
  },

  awp: {
    name: 'AWP',
    steel: 3000,
    value: 65000
  },

  m16: {
    name: 'M16',
    steel: 2700,
    value: 35000
  },

  sawedoff: {
    name: 'Sawed-Off Shotgun',
    steel: 1200,
    value: 20000
  },

  glock17: {
    name: 'Glock 17',
    steel: 120,
    value: 5000
  },

  tec9: {
    name: 'TEC-9',
    steel: 900,
    value: 15000
  },

  taser: {
    name: 'Taser',
    steel: 700,
    value: 10000
  },

  box556: {
    name: 'Box M. 5.56',
    steel: 120,
    value: 5000
  },

  box308: {
    name: 'Box M. .308',
    steel: 200,
    value: 5000
  }
};

// ====================================================================
// DATABASE
// ====================================================================

function verificarDatabase() {
  const pasta = path.dirname(DB_PATH);

  if (!fs.existsSync(pasta)) {
    fs.mkdirSync(pasta, {
      recursive: true
    });
  }

  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify(
        {
          estoque: 0,
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

    if (typeof db.estoque !== 'number') {
      db.estoque = 0;
    }

    if (!Array.isArray(db.vendas)) {
      db.vendas = [];
    }

    return db;
  } catch (error) {
    console.error(
      '❌ Erro ao carregar database:',
      error
    );

    return {
      estoque: 0,
      vendas: []
    };
  }
}

function salvarDb(db) {
  verificarDatabase();

  fs.writeFileSync(
    DB_PATH,
    JSON.stringify(db, null, 2)
  );
}

// ====================================================================
// FUNÇÕES
// ====================================================================

function numero(valor) {
  return Number(valor).toLocaleString('pt-BR');
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

  if (!busca) {
    return null;
  }

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
  return interaction.member?.roles?.cache?.has(
    GERENTE_ROLE_ID
  );
}

function criarErroPermissao() {
  return {
    content:
      '🚫 **ACESSO NEGADO!**\n\n' +
      '🐺 Somente membros com o cargo **Gerentes** podem alterar o estoque.',
    ephemeral: true
  };
}

// ====================================================================
// PAINEL
// ====================================================================

function criarPainel() {
  const db = carregarDb();

  const kits = Math.floor(
    db.estoque / KIT_COST
  );

  const totalVendas = db.vendas.reduce(
    (total, venda) =>
      total + Number(venda.total || 0),
    0
  );

  const embed = new EmbedBuilder()
    .setTitle('🐺 HUNTERS BOT — PAINEL CENTRAL')
    .setColor('#8B5CF6')
    .setDescription(
      '## 🐺 SISTEMA DE GESTÃO HUNTERS\n' +
      'Controle de estoque, produção e vendas.'
    )
    .addFields(
      {
        name: '🛠️ Estoque de Aço',
        value: `**${numero(db.estoque)} Aços**`,
        inline: true
      },
      {
        name: '🎁 Capacidade de Kits',
        value: `**${numero(kits)} Kits**`,
        inline: true
      },
      {
        name: '💰 Total em Vendas',
        value: `**${dinheiro(totalVendas)}**`,
        inline: true
      },
      {
        name: '📜 Vendas Registradas',
        value: `**${numero(db.vendas.length)} vendas**`,
        inline: true
      }
    )
    .setFooter({
      text: 'HUNTERS BOT v2.1 🐺'
    })
    .setTimestamp();

  const linha1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('estoque')
        .setLabel('Estoque')
        .setEmoji('📦')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('adicionar_aco')
        .setLabel('Adicionar Aço')
        .setEmoji('➕')
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId('retirar_aco')
        .setLabel('Retirar Aço')
        .setEmoji('➖')
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId('kits')
        .setLabel('Kits')
        .setEmoji('🎁')
        .setStyle(ButtonStyle.Secondary)
    );

  const linha2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('registrar_venda')
        .setLabel('Registrar Venda')
        .setEmoji('💰')
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId('ranking')
        .setLabel('Ranking')
        .setEmoji('🏆')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('historico')
        .setLabel('Histórico')
        .setEmoji('📜')
        .setStyle(ButtonStyle.Secondary)
    );

  return {
    embeds: [embed],
    components: [linha1, linha2]
  };
}

// ====================================================================
// READY
// ====================================================================

client.once('ready', () => {
  verificarDatabase();

  console.log('===================================');
  console.log('🐺 HUNTERS BOT v2.1 ONLINE');
  console.log(`🤖 ${client.user.tag}`);
  console.log('===================================');

  client.user.setActivity(
    'Gestão HUNTERS 🐺',
    {
      type: ActivityType.Watching
    }
  );
});

// ====================================================================
// COMANDOS
// ====================================================================

client.on('messageCreate', async message => {
  if (message.author.bot) {
    return;
  }

  if (!message.guild) {
    return;
  }

  if (!message.content.startsWith(PREFIX)) {
    return;
  }

  const args = message.content
    .slice(PREFIX.length)
    .trim()
    .split(/\s+/);

  const command = args.shift()?.toLowerCase();

  if (command === 'painel') {
    return message.channel.send(
      criarPainel()
    );
  }

  if (command === 'estoque') {
    const db = carregarDb();

    return message.reply(
      `📦 Estoque atual: **${numero(db.estoque)} Aços**`
    );
  }
});

// ====================================================================
// INTERAÇÕES
// ====================================================================

client.on('interactionCreate', async interaction => {
  try {

    // ================================================================
    // BOTÕES
    // ================================================================

    if (interaction.isButton()) {

      // ==============================================================
      // ESTOQUE
      // ==============================================================

      if (interaction.customId === 'estoque') {
        const db = carregarDb();

        const clanAco = Math.floor(
          db.estoque * 0.60
        );

        const vendaAco =
          db.estoque - clanAco;

        const kits = Math.floor(
          clanAco / KIT_COST
        );

        const embed = new EmbedBuilder()
          .setTitle('📦 ESTOQUE HUNTERS')
          .setColor('#3B82F6')
          .addFields(
            {
              name: '💎 Estoque Total',
              value:
                `**${numero(db.estoque)} Aços**`
            },
            {
              name: '🐺 60% Clã',
              value:
                `${numero(clanAco)} Aços`,
              inline: true
            },
            {
              name: '💰 40% Venda',
              value:
                `${numero(vendaAco)} Aços`,
              inline: true
            },
            {
              name: '🎁 Kits do Clã',
              value:
                `**${numero(kits)} Kits completos**`
            }
          )
          .setFooter({
            text: 'HUNTERS Estoque 🐺'
          })
          .setTimestamp();

        return interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
      }

      // ==============================================================
      // ADICIONAR AÇO — SOMENTE GERENTES
      // ==============================================================

      if (
        interaction.customId ===
        'adicionar_aco'
      ) {
        if (!podeAlterarEstoque(interaction)) {
          return interaction.reply(
            criarErroPermissao()
          );
        }

        const modal = new ModalBuilder()
          .setCustomId('modal_adicionar_aco')
          .setTitle('Adicionar Aço');

        const input = new TextInputBuilder()
          .setCustomId('quantidade')
          .setLabel('Quantidade de aço')
          .setPlaceholder('Exemplo: 5000')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder()
            .addComponents(input)
        );

        return interaction.showModal(modal);
      }

      // ==============================================================
      // RETIRAR AÇO — SOMENTE GERENTES
      // ==============================================================

      if (
        interaction.customId ===
        'retirar_aco'
      ) {
        if (!podeAlterarEstoque(interaction)) {
          return interaction.reply(
            criarErroPermissao()
          );
        }

        const modal = new ModalBuilder()
          .setCustomId('modal_retirar_aco')
          .setTitle('Retirar Aço');

        const input = new TextInputBuilder()
          .setCustomId('quantidade')
          .setLabel('Quantidade de aço')
          .setPlaceholder('Exemplo: 3760')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder()
            .addComponents(input)
        );

        return interaction.showModal(modal);
      }

      // ==============================================================
      // KITS
      // ==============================================================

      if (interaction.customId === 'kits') {
        const db = carregarDb();

        const kits = Math.floor(
          db.estoque / KIT_COST
        );

        const sobra =
          db.estoque % KIT_COST;

        const embed = new EmbedBuilder()
          .setTitle('🎁 CALCULADORA DE KITS')
          .setColor('#8B5CF6')
          .setDescription(
            '⚡ **1x Taser**\n' +
            '🔫 **1x AK-47**\n' +
            '📦 **3x Box M. 5.56**\n\n' +
            `💎 Custo: **${numero(KIT_COST)} Aços**`
          )
          .addFields(
            {
              name: '🎁 Kits',
              value:
                `**${numero(kits)} Kits completos**`,
              inline: true
            },
            {
              name: '📦 Sobra',
              value:
                `**${numero(sobra)} Aços**`,
              inline: true
            }
          )
          .setFooter({
            text: 'HUNTERS Kits 🐺'
          })
          .setTimestamp();

        return interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
      }

      // ==============================================================
      // REGISTRAR VENDA
      // ==============================================================

      if (
        interaction.customId ===
        'registrar_venda'
      ) {
        const modal = new ModalBuilder()
          .setCustomId('modal_venda')
          .setTitle('Registrar Venda');

        const item = new TextInputBuilder()
          .setCustomId('item')
          .setLabel('Item vendido')
          .setPlaceholder('Exemplo: AK-47')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const quantidade = new TextInputBuilder()
          .setCustomId('quantidade')
          .setLabel('Quantidade')
          .setPlaceholder('Exemplo: 5')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const desconto = new TextInputBuilder()
          .setCustomId('desconto')
          .setLabel('Desconto de 15%?')
          .setPlaceholder('sim ou nao')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder()
            .addComponents(item),

          new ActionRowBuilder()
            .addComponents(quantidade),

          new ActionRowBuilder()
            .addComponents(desconto)
        );

        return interaction.showModal(modal);
      }

      // ==============================================================
      // RANKING
      // ==============================================================

      if (interaction.customId === 'ranking') {
        const db = carregarDb();

        const ranking = {};

        for (const venda of db.vendas) {
          if (!ranking[venda.userId]) {
            ranking[venda.userId] = {
              total: 0,
              vendas: 0
            };
          }

          ranking[venda.userId].total +=
            Number(venda.total || 0);

          ranking[venda.userId].vendas++;
        }

        const resultado =
          Object.entries(ranking)
            .sort(
              (a, b) =>
                b[1].total - a[1].total
            )
            .slice(0, 10);

        let texto = '';

        resultado.forEach(
          ([userId, dados], index) => {
            texto +=
              `**${index + 1}º** <@${userId}>\n` +
              `💰 ${dinheiro(dados.total)} | ` +
              `📜 ${dados.vendas} vendas\n\n`;
          }
        );

        if (!texto) {
          texto =
            'Nenhuma venda registrada.';
        }

        const embed = new EmbedBuilder()
          .setTitle(
            '🏆 RANKING DE VENDAS — HUNTERS'
          )
          .setColor('#F59E0B')
          .setDescription(texto)
          .setFooter({
            text: 'HUNTERS Ranking 🐺'
          })
          .setTimestamp();

        return interaction.reply({
          embeds: [embed]
        });
      }

      // ==============================================================
      // HISTÓRICO
      // ==============================================================

      if (
        interaction.customId ===
        'historico'
      ) {
        const db = carregarDb();

        const vendas = db.vendas
          .slice(-10)
          .reverse();

        let texto = '';

        vendas.forEach(venda => {
          texto +=
            `👤 <@${venda.userId}>\n` +
            `🔫 ${venda.quantidade}x ${venda.item}\n` +
            `💰 ${dinheiro(venda.total)}\n` +
            `📅 ${venda.data}\n\n`;
        });

        if (!texto) {
          texto =
            'Nenhuma venda registrada.';
        }

        const embed = new EmbedBuilder()
          .setTitle('📜 ÚLTIMAS VENDAS')
          .setColor('#EC4899')
          .setDescription(texto)
          .setFooter({
            text: 'HUNTERS Histórico 🐺'
          })
          .setTimestamp();

        return interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
      }
    }

    // ================================================================
    // MODAIS
    // ================================================================

    if (interaction.isModalSubmit()) {

      // ==============================================================
      // ADICIONAR AÇO
      // ==============================================================

      if (
        interaction.customId ===
        'modal_adicionar_aco'
      ) {
        if (!podeAlterarEstoque(interaction)) {
          return interaction.reply(
            criarErroPermissao()
          );
        }

        const quantidade = Number(
          interaction.fields
            .getTextInputValue('quantidade')
        );

        if (
          !Number.isInteger(quantidade) ||
          quantidade <= 0
        ) {
          return interaction.reply({
            content:
              '❌ Quantidade de aço inválida.',
            ephemeral: true
          });
        }

        const db = carregarDb();

        db.estoque += quantidade;

        salvarDb(db);

        return interaction.reply({
          content:
            `✅ **${numero(quantidade)} Aços adicionados!**\n\n` +
            `👤 Gerente: <@${interaction.user.id}>\n` +
            `📦 Estoque atual: **${numero(db.estoque)} Aços**`,
          ephemeral: true
        });
      }

      // ==============================================================
      // RETIRAR AÇO
      // ==============================================================

      if (
        interaction.customId ===
        'modal_retirar_aco'
      ) {
        if (!podeAlterarEstoque(interaction)) {
          return interaction.reply(
            criarErroPermissao()
          );
        }

        const quantidade = Number(
          interaction.fields
            .getTextInputValue('quantidade')
        );

        if (
          !Number.isInteger(quantidade) ||
          quantidade <= 0
        ) {
          return interaction.reply({
            content:
              '❌ Quantidade inválida.',
            ephemeral: true
          });
        }

        const db = carregarDb();

        if (quantidade > db.estoque) {
          return interaction.reply({
            content:
              '❌ O estoque não possui aço suficiente.',
            ephemeral: true
          });
        }

        db.estoque -= quantidade;

        salvarDb(db);

        return interaction.reply({
          content:
            `➖ **${numero(quantidade)} Aços retirados!**\n\n` +
            `👤 Gerente: <@${interaction.user.id}>\n` +
            `📦 Estoque atual: **${numero(db.estoque)} Aços**`,
          ephemeral: true
        });
      }

      // ==============================================================
      // VENDA
      // ==============================================================

      if (
        interaction.customId ===
        'modal_venda'
      ) {
        const nomeItem =
          interaction.fields
            .getTextInputValue('item');

        const quantidade = Number(
          interaction.fields
            .getTextInputValue('quantidade')
        );

        const respostaDesconto =
          interaction.fields
            .getTextInputValue('desconto')
            .trim()
            .toLowerCase();

        const item = buscarItem(nomeItem);

        if (!item) {
          return interaction.reply({
            content:
              `❌ Item **${nomeItem}** não encontrado.`,
            ephemeral: true
          });
        }

        if (
          !Number.isInteger(quantidade) ||
          quantidade <= 0
        ) {
          return interaction.reply({
            content:
              '❌ Quantidade inválida.',
            ephemeral: true
          });
        }

        const aplicarDesconto =
          respostaDesconto === 'sim' ||
          respostaDesconto === 's';

        const valorUnitario =
          aplicarDesconto
            ? Math.round(item.value * 0.85)
            : item.value;

        const total =
          valorUnitario * quantidade;

        const cla =
          Math.round(total * 0.70);

        const membro =
          total - cla;

        const acoNecessario =
          item.steel * quantidade;

        const db = carregarDb();

        if (acoNecessario > db.estoque) {
          return interaction.reply({
            content:
              '❌ **AÇO INSUFICIENTE!**\n\n' +
              `🛠️ Necessário: **${numero(acoNecessario)} Aços**\n` +
              `📦 Estoque atual: **${numero(db.estoque)} Aços**`,
            ephemeral: true
          });
        }

        db.estoque -= acoNecessario;

        db.vendas.push({
          id: Date.now(),
          userId: interaction.user.id,
          userName:
            interaction.user.username,
          item: item.name,
          quantidade,
          valorUnitario,
          total,
          cla,
          membro,
          aco: acoNecessario,
          desconto: aplicarDesconto,
          data:
            new Date().toLocaleString(
              'pt-BR',
              {
                timeZone:
                  'America/Sao_Paulo'
              }
            )
        });

        salvarDb(db);

        const embed = new EmbedBuilder()
          .setTitle(
            '💰 VENDA REGISTRADA — HUNTERS'
          )
          .setColor('#22C55E')
          .setThumbnail(
            interaction.user
              .displayAvatarURL()
          )
          .addFields(
            {
              name: '👤 Vendedor',
              value:
                `<@${interaction.user.id}>`
            },
            {
              name: '🔫 Item',
              value: item.name,
              inline: true
            },
            {
              name: '📦 Quantidade',
              value: `${quantidade}x`,
              inline: true
            },
            {
              name: '🛠️ Aço utilizado',
              value:
                `${numero(acoNecessario)} Aços`,
              inline: true
            },
            {
              name: '💵 Valor Unitário',
              value:
                dinheiro(valorUnitario),
              inline: true
            },
            {
              name: '💰 Total',
              value:
                `**${dinheiro(total)}**`,
              inline: true
            },
            {
              name: '🏷️ Desconto',
              value:
                aplicarDesconto
                  ? '15% aplicado'
                  : 'Sem desconto',
              inline: true
            },
            {
              name: '🏦 Clã — 70%',
              value: dinheiro(cla),
              inline: true
            },
            {
              name: '💵 Membro — 30%',
              value: dinheiro(membro),
              inline: true
            },
            {
              name: '📦 Estoque restante',
              value:
                `${numero(db.estoque)} Aços`
            }
          )
          .setFooter({
            text: 'HUNTERS Vendas 🐺'
          })
          .setTimestamp();

        return interaction.reply({
          embeds: [embed]
        });
      }
    }
  } catch (error) {
    console.error(
      '❌ ERRO NA INTERAÇÃO:',
      error
    );

    if (
      interaction.isRepliable() &&
      !interaction.replied &&
      !interaction.deferred
    ) {
      return interaction.reply({
        content:
          '❌ Ocorreu um erro ao executar esta ação.',
        ephemeral: true
      });
    }
  }
});

// ====================================================================
// ERROS
// ====================================================================

process.on(
  'unhandledRejection',
  error => {
    console.error(
      '❌ ERRO NÃO TRATADO:',
      error
    );
  }
);

// ====================================================================
// LOGIN
// ====================================================================

if (!process.env.TOKEN) {
  console.error(
    '❌ TOKEN não encontrado no arquivo .env!'
  );

  process.exit(1);
}

client.login(process.env.TOKEN);
