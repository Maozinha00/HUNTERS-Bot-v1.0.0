// ====================================================================
//                 🐺 HUNTERS BOT DISCORD 🐺
// ====================================================================
// Versão: 1.1.0
// Discord.js v14
// ====================================================================

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActivityType
} = require('discord.js');

require('dotenv').config();

// ====================================================================
// CLIENTE
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

const PREFIX = '!';

const KIT_COST = 3760;

// ====================================================================
// BANCO DE DADOS
// ====================================================================

const itensDb = {
  ak47: {
    name: 'AK-47',
    steel: 2700,
    value: 35000,
    category: 'Armas'
  },

  awp: {
    name: 'AWP',
    steel: 3000,
    value: 65000,
    category: 'Armas'
  },

  m16: {
    name: 'M16',
    steel: 2700,
    value: 35000,
    category: 'Armas'
  },

  sawedoff: {
    name: 'Sawed-Off Shotgun',
    steel: 1200,
    value: 20000,
    category: 'Armas'
  },

  glock17: {
    name: 'Glock 17',
    steel: 120,
    value: 5000,
    category: 'Armas'
  },

  tec9: {
    name: 'TEC-9',
    steel: 900,
    value: 15000,
    category: 'Armas'
  },

  taser: {
    name: 'Taser',
    steel: 700,
    value: 10000,
    category: 'Armas'
  },

  box_pistola: {
    name: 'Box M. Pistola',
    steel: 40,
    value: 2000,
    category: 'Caixas de Munição'
  },

  box_sub: {
    name: 'Box M. Sub',
    steel: 80,
    value: 3000,
    category: 'Caixas de Munição'
  },

  box_escopeta: {
    name: 'Box M. Escopeta',
    steel: 100,
    value: 4000,
    category: 'Caixas de Munição'
  },

  box_556: {
    name: 'Box M. 5.56',
    steel: 120,
    value: 5000,
    category: 'Caixas de Munição'
  },

  box_308: {
    name: 'Box M. .308',
    steel: 200,
    value: 5000,
    category: 'Caixas de Munição'
  },

  silenciador: {
    name: 'Silenciador',
    steel: 20,
    value: 2000,
    category: 'Acessórios'
  },

  carregador_est: {
    name: 'Carregador Est.',
    steel: 25,
    value: 3000,
    category: 'Acessórios'
  },

  grip: {
    name: 'Grip',
    steel: 30,
    value: 3000,
    category: 'Acessórios'
  },

  lanterna: {
    name: 'Lanterna',
    steel: 30,
    value: 2000,
    category: 'Acessórios'
  }
};

// ====================================================================
// FUNÇÕES
// ====================================================================

function formatarNumero(numero) {
  return numero.toLocaleString('pt-BR');
}

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function buscarItem(nome) {
  const busca = normalizarTexto(nome);

  if (!busca) return null;

  for (const [key, item] of Object.entries(itensDb)) {
    const chaveNormalizada = normalizarTexto(key);
    const nomeNormalizado = normalizarTexto(item.name);

    if (
      chaveNormalizada === busca ||
      nomeNormalizado === busca ||
      nomeNormalizado.includes(busca)
    ) {
      return item;
    }
  }

  return null;
}

// ====================================================================
// BOT ONLINE
// ====================================================================

client.once('ready', () => {
  console.log('==========================================');
  console.log(`🐺 HUNTERS BOT ONLINE`);
  console.log(`🤖 Logado como: ${client.user.tag}`);
  console.log('==========================================');

  client.user.setActivity('Calculadora Hunters | !ajuda', {
    type: ActivityType.Listening
  });
});

// ====================================================================
// COMANDOS
// ====================================================================

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (!message.guild) return;

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content
    .slice(PREFIX.length)
    .trim()
    .split(/\s+/);

  const command = args.shift()?.toLowerCase();

  if (!command) return;

  // ================================================================
  // AJUDA
  // ================================================================

  if (command === 'ajuda' || command === 'help') {
    const embed = new EmbedBuilder()
      .setTitle('🐺 CENTRAL DE AJUDA — HUNTERS BOT')
      .setColor('#8B5CF6')
      .setDescription(
        'Calculadora oficial de produção e vendas da **HUNTERS**.'
      )
      .addFields(
        {
          name: '🎁 !kit [aço]',
          value:
            'Calcula quantos Kits da Meta podem ser fabricados.\n' +
            '`!kit 15000`'
        },
        {
          name: '🛒 !venda [item] [qtd]',
          value:
            'Calcula uma venda e divide 70/30.\n' +
            '`!venda AK-47 5`'
        },
        {
          name: '🏷️ !venda [item] [qtd] d',
          value:
            'Aplica 15% de desconto.\n' +
            '`!venda AK-47 5 d`'
        },
        {
          name: '🛠️ !producao [aço]',
          value:
            'Mostra a capacidade de fabricação.\n' +
            '`!producao 20000`'
        },
        {
          name: '📢 !estoque [aço]',
          value:
            'Divide o estoque em 60% Clã e 40% Venda.\n' +
            '`!estoque 50000`'
        }
      )
      .setFooter({
        text: 'HUNTERS Organization 🐺'
      })
      .setTimestamp();

    return message.reply({
      embeds: [embed]
    });
  }

  // ================================================================
  // KIT
  // ================================================================

  if (command === 'kit') {
    const aco = Number(args[0]);

    if (!Number.isInteger(aco) || aco < 0) {
      return message.reply(
        '❌ Use: `!kit [quantidade de aço]`\n' +
        'Exemplo: `!kit 15000`'
      );
    }

    const kits = Math.floor(aco / KIT_COST);
    const sobra = aco % KIT_COST;

    const embed = new EmbedBuilder()
      .setTitle('🎁 CALCULADORA DE KIT — HUNTERS')
      .setColor('#8B5CF6')
      .setDescription(
        `🛠️ **Aço disponível:** ${formatarNumero(aco)}\n\n` +
        `## 🎁 KIT DA META\n` +
        `⚡ 1x Taser\n` +
        `🔫 1x AK-47\n` +
        `📦 3x Box M. 5.56\n\n` +
        `💎 **Custo por Kit:** ${formatarNumero(KIT_COST)} Aços`
      )
      .addFields(
        {
          name: '✅ Kits completos',
          value: `**${kits} Kit${kits !== 1 ? 's' : ''}**`,
          inline: true
        },
        {
          name: '📦 Aço restante',
          value: `**${formatarNumero(sobra)} Aços**`,
          inline: true
        }
      )
      .setFooter({
        text: 'Hunters Bot 🐺'
      })
      .setTimestamp();

    return message.reply({
      embeds: [embed]
    });
  }

  // ================================================================
  // VENDA
  // ================================================================

  if (command === 'venda') {
    if (args.length < 2) {
      return message.reply(
        '❌ **Sintaxe incorreta!**\n\n' +
        '`!venda AK-47 10`\n' +
        '`!venda AK-47 10 d`'
      );
    }

    let applyDiscount = false;

    const ultimoArgumento = args[args.length - 1]?.toLowerCase();

    if (
      ultimoArgumento === 'd' ||
      ultimoArgumento === 'desc' ||
      ultimoArgumento === 'desconto'
    ) {
      applyDiscount = true;
      args.pop();
    }

    const qty = Number(args.pop());

    if (!Number.isInteger(qty) || qty <= 0) {
      return message.reply(
        '❌ Informe uma quantidade válida.\n' +
        'Exemplo: `!venda AK-47 10`'
      );
    }

    const itemName = args.join(' ');

    if (!itemName) {
      return message.reply(
        '❌ Informe o nome do item.'
      );
    }

    const item = buscarItem(itemName);

    if (!item) {
      return message.reply(
        `❌ Item \`${itemName}\` não encontrado.\n\n` +
        'Exemplo: `!venda AK-47 10`'
      );
    }

    const desconto = applyDiscount ? 0.15 : 0;

    const valorUnitario = Math.round(
      item.value * (1 - desconto)
    );

    const valorTotal = valorUnitario * qty;

    const caixaCla = Math.round(valorTotal * 0.70);

    const membro = valorTotal - caixaCla;

    const acoNecessario = item.steel * qty;

    const embed = new EmbedBuilder()
      .setTitle(
        `🐺 VENDA HUNTERS — ${item.name.toUpperCase()}`
      )
      .setColor(
        applyDiscount ? '#F59E0B' : '#F472B6'
      )
      .addFields(
        {
          name: '🔫 Item',
          value: item.name,
          inline: true
        },
        {
          name: '📦 Quantidade',
          value: `${qty} unidade(s)`,
          inline: true
        },
        {
          name: '🛠️ Aço necessário',
          value: `${formatarNumero(acoNecessario)} Aços`,
          inline: true
        },
        {
          name: '💵 Valor unitário',
          value: `R$ ${formatarNumero(valorUnitario)}`,
          inline: true
        },
        {
          name: '💰 Valor total',
          value: `**R$ ${formatarNumero(valorTotal)}**`,
          inline: true
        },
        {
          name: '🏷️ Desconto',
          value: applyDiscount ? '**15% aplicado**' : 'Sem desconto',
          inline: true
        },
        {
          name: '🏦 Caixa do Clã — 70%',
          value: `**R$ ${formatarNumero(caixaCla)}**`,
          inline: true
        },
        {
          name: '💵 Membro — 30%',
          value: `**R$ ${formatarNumero(membro)}**`,
          inline: true
        }
      )
      .setFooter({
        text: 'HUNTERS Vendas 🐺'
      })
      .setTimestamp();

    return message.reply({
      embeds: [embed]
    });
  }

  // ================================================================
  // PRODUÇÃO
  // ================================================================

  if (command === 'producao') {
    const aco = Number(args[0]);

    if (!Number.isInteger(aco) || aco < 0) {
      return message.reply(
        '❌ Use: `!producao [aço]`\n' +
        'Exemplo: `!producao 20000`'
      );
    }

    const fields = [];

    for (const item of Object.values(itensDb)) {
      if (
        item.category !== 'Armas' &&
        item.category !== 'Caixas de Munição'
      ) {
        continue;
      }

      const quantidade = Math.floor(aco / item.steel);

      if (quantidade <= 0) continue;

      const sobra = aco % item.steel;

      fields.push({
        name: `🔹 ${item.name}`,
        value:
          `**${formatarNumero(quantidade)} unidade(s)**\n` +
          `🛠️ ${formatarNumero(item.steel)} aço/un\n` +
          `📦 Sobra: ${formatarNumero(sobra)}`,
        inline: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('🛠️ PRODUÇÃO COM AÇO — HUNTERS')
      .setColor('#34D399')
      .setDescription(
        `💎 Estoque analisado: **${formatarNumero(aco)} Aços**\n\n` +
        'Possibilidades individuais de fabricação:'
      );

    if (fields.length > 0) {
      embed.addFields(fields.slice(0, 25));
    } else {
      embed.addFields({
        name: '❌ Produção indisponível',
        value: 'A quantidade de aço não é suficiente.'
      });
    }

    embed
      .setFooter({
        text: 'HUNTERS Armaria Ativa 🐺'
      })
      .setTimestamp();

    return message.reply({
      embeds: [embed]
    });
  }

  // ================================================================
  // ESTOQUE
  // ================================================================

  if (command === 'estoque') {
    const totalAco = Number(args[0]);

    if (!Number.isInteger(totalAco) || totalAco < 0) {
      return message.reply(
        '❌ Use: `!estoque [quantidade de aço]`\n' +
        'Exemplo: `!estoque 50000`'
      );
    }

    const percentClan = 60;
    const percentSale = 40;

    const clanAco = Math.floor(
      totalAco * (percentClan / 100)
    );

    const saleAco = totalAco - clanAco;

    const kits = Math.floor(clanAco / KIT_COST);

    const sobra = clanAco % KIT_COST;

    const embed = new EmbedBuilder()
      .setTitle('📢 ESTOQUE ATUALIZADO — HUNTERS')
      .setColor('#3B82F6')
      .setDescription(
        `💎 **Baú atual: ${formatarNumero(totalAco)} Aços!**\n\n` +
        '🐺 Organização e produção da HUNTERS.'
      )
      .addFields(
        {
          name: '📦 60% → ESTOQUE DO CLÃ',
          value:
            `**${formatarNumero(clanAco)} Aços**\n` +
            '🎁 Kits e Guerras',
          inline: true
        },
        {
          name: '💰 40% → PRODUÇÃO PARA VENDA',
          value:
            `**${formatarNumero(saleAco)} Aços**\n` +
            '🔫 Produção de armas',
          inline: true
        },
        {
          name: '🎁 CAPACIDADE DE KITS',
          value:
            `**${kits} Kits completos**\n` +
            `📦 Sobra: ${formatarNumero(sobra)} Aços`,
          inline: false
        }
      )
      .setFooter({
        text: 'HUNTERS 🐺 Sempre Unidos'
      })
      .setTimestamp();

    return message.reply({
      embeds: [embed]
    });
  }
});

// ====================================================================
// LOGIN
// ====================================================================

if (!process.env.TOKEN) {
  console.error('❌ TOKEN não encontrado no arquivo .env!');
  process.exit(1);
}

client.login(process.env.TOKEN);
