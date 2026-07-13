import { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle,
  InteractionType
} from 'discord.js';
import axios from 'axios';

// ==========================================
// CONFIGURAÇÕES INICIAIS
// ==========================================
const TOKEN = process.env.DISCORD_TOKEN;
const API_URL = process.env.API_URL;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// TABELA DE ARMAS, COMPONENTES E REQUISITOS DE AÇO / PREÇOS REVISADOS
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

// COMPONENTES DOS KITS DA META (3.260 kg total por Kit)
const CONFIG_KITS = {
  custo_kit: 3260,
  itens: {
    ak47: { nome: "AK-47", quantidade: 1, aco: 1000 },
    coletes: { nome: "Colete Tático", quantidade: 5, aco: 1500 },
    municao: { nome: "Munições de Fuzil", quantidade: 250, aco: 760 }
  }
};

// Estado Local Simulado do Banco de Dados (em caso de falha da API)
let db = {
  estoqueAco: 15400,
  estoqueKits: 45000,
  vendas: [
    { id: "V-102934", userId: "1", userName: "Henrique", arma: "AK-47", quantidade: 2, total: 59500, desconto: 15, comissao: 17850, acoConsumido: 5400 },
    { id: "V-120934", userId: "2", userName: "Jonas", arma: "Glock 17", quantidade: 5, total: 25000, desconto: 0, comissao: 7500, acoConsumido: 600 }
  ],
  farmes: [
    { id: "F-102931", userId: "1", userName: "Henrique", quantidade: 8000, timestamp: new Date().toISOString() },
    { id: "F-120933", userId: "2", userName: "Jonas", quantidade: 4500, timestamp: new Date().toISOString() }
  ],
  config: {
    metaSemanal: 100000,
    precoAcoCompra: 12,
    precoAcoVenda: 15,
    canalPainelId: "123456789012345678",
    canalLogsId: "123456789012345679",
    CARGO_NOTIFICAR_ID: "1515125826780135485" // Cargo Tático (ex: Líderes, Logística, Staff)
  }
};

// Helper de Sincronização com ERP
async function syncWithERP() {
  try {
    const res = await axios.get(`${API_URL}/api/db`);
    db = res.data;
    console.log("Sincronizado com o ERP central!");
  } catch (err) {
    console.log("Usando banco local offline temporário (ERP não configurado ainda).");
  }
}

async function postToERP(action, data) {
  try {
    const res = await axios.post(`${API_URL}/api/action`, { action, data });
    db = res.data;
    return true;
  } catch (err) {
    // Atualização local de contingência caso offline
    if (action === 'add_aco') {
      db.estoqueAco += data.quantidade;
    } else if (action === 'sub_aco') {
      db.estoqueAco = Math.max(0, db.estoqueAco - data.quantidade);
    } else if (action === 'farme') {
      db.estoqueKits += data.quantidade;
      db.farmes.unshift({
        id: `F-${Math.floor(Math.random() * 900000 + 100000)}`,
        userId: data.userId,
        userName: data.userName,
        quantidade: data.quantidade,
        timestamp: new Date().toISOString()
      });
    } else if (action === 'venda') {
      const totalSemDesconto = data.precoUnitario * data.quantidade;
      const totalComDesconto = totalSemDesconto * (1 - data.desconto / 100);
      const comissao = totalComDesconto * 0.30; // 30% comissão padrão
      const totalAco = data.acoUnitario * data.quantidade;

      db.estoqueAco = Math.max(0, db.estoqueAco - totalAco);
      db.vendas.unshift({
        id: `V-${Math.floor(Math.random() * 900000 + 100000)}`,
        userId: data.userId,
        userName: data.userName,
        arma: data.itemNome,
        quantidade: data.quantidade,
        total: totalComDesconto,
        desconto: data.desconto,
        comissao: comissao,
        acoConsumido: totalAco
      });
    }
    return false;
  }
}

// FORMATADOR DE VALORES (R$)
const formatBRL = (val) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

// ==========================================
// EVENTO: BOT ONLINE
// ==========================================
client.once('ready', async () => {
  console.log(`🤖 ${client.user.tag} está online e pronto para os Hunters!`);
  await syncWithERP();
});

// ==========================================
// COMANDO: ENVIAR PAINEL OPERACIONAL PRINCIPAL
// ==========================================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // COMANDO: INICIAR PAINEL
  if (command === '!setup_painel' || command === '!painel') {
    if (!message.member.permissions.has('Administrator')) {
      return message.reply("❌ Apenas administradores podem configurar o Painel Central.");
    }

    const embed = new EmbedBuilder()
      .setTitle('🐺 HUNTERS LOGÍSTICA & CONTROLE CENTRAL')
      .setDescription(
        `Bem-vindo ao centro logístico operacional dos **Hunters**.\n` +
        `Utilize os botões interativos abaixo para registrar atividades, gerenciar o estoque tático e consultar o arsenal.`
      )
      .addFields(
        { name: '📦 Kits de Meta Disponíveis', value: `\`${Math.floor(db.estoqueKits / CONFIG_KITS.custo_kit)} Kits\` (${(db.estoqueKits).toLocaleString()} kg no total)`, inline: true },
        { name: '🛠️ Aço em Estoque', value: `\`${db.estoqueAco.toLocaleString()} kg\``, inline: true }
      )
      .setColor('#a855f7')
      .setThumbnail(client.user.displayAvatarURL())
      .setFooter({ text: "Hunters ERP • Integrado ao Sistema" })
      .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_farme').setLabel('🌾 Registrar Farme').setStyle(ButtonStyle.Success).setEmoji('📦'),
      new ButtonBuilder().setCustomId('btn_venda').setLabel('💰 Registrar Venda').setStyle(ButtonStyle.Primary).setEmoji('🤝'),
      new ButtonBuilder().setCustomId('btn_consultar_estoque').setLabel('🔍 Consultar Estoque').setStyle(ButtonStyle.Secondary).setEmoji('📊')
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_add_aco').setLabel('➕ Adicionar Aço').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('btn_sub_aco').setLabel('➖ Remover Aço').setStyle(ButtonStyle.Danger)
    );

    await message.channel.send({ embeds: [embed], components: [row1, row2] });
  }

  // COMANDO: ESTADO GERAL RÁPIDO COM RESTRIÇÃO DE CARGO
  if (command === 'status' || command === 'logistica') {
    const cargoNotificarId = db.config.CARGO_NOTIFICAR_ID || '1515125826780135485';
    const hasRole = message.member.roles.cache.has(cargoNotificarId) || 
                    message.member.roles.cache.some(r => ['Líder', 'Vendedor Elite', 'Farmador Pro', 'Staff'].includes(r.name)) || 
                    message.member.permissions.has('Administrator');
    if (!hasRole) {
      return message.reply(`❌ **Acesso Negado!** Você precisa ter o cargo <@&${cargoNotificarId}> para consultar o estoque.`);
    }

    const kitsProntos = Math.floor(db.estoqueKits / CONFIG_KITS.custo_kit);
    const embedStatus = new EmbedBuilder()
      .setTitle('📊 ESTADO GERAL DE RECURSOS - HUNTERS')
      .setColor('#a855f7')
      .addFields(
        { name: '🛠️ Aço Disponível', value: `**${db.estoqueAco.toLocaleString()} kg**`, inline: true },
        { name: '📦 Farme no Estoque', value: `**${db.estoqueKits.toLocaleString()} kg**`, inline: true },
        { name: '⚔️ Kits Prontos para Entrega', value: `**${kitsProntos} Kits** (${(kitsProntos * CONFIG_KITS.custo_kit).toLocaleString()} kg consumidos)`, inline: true }
      )
      .setFooter({ text: "Consulta Rápida de Segurança" })
      .setTimestamp();

    await message.reply({ embeds: [embedStatus] });
  }
});

// ==========================================
// INTERAÇÕES (BOTÕES E MODAIS)
// ==========================================
client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    const { customId } = interaction;

    // BOTÃO: REGISTRAR FARME (Abre Modal)
    if (customId === 'btn_farme') {
      const modal = new ModalBuilder().setCustomId('modal_farme').setTitle('🌾 REGISTRAR NOVO FARME');

      const inputQtd = new TextInputBuilder()
        .setCustomId('farme_quantidade')
        .setLabel('Quantidade de Farme Coletada (em kg)')
        .setPlaceholder('Ex: 5000')
        .setRequired(true)
        .setStyle(TextInputStyle.Short);

      modal.addComponents(new ActionRowBuilder().addComponents(inputQtd));
      await interaction.showModal(modal);
    }

    // BOTÃO: REGISTRAR VENDA (Abre Modal)
    if (customId === 'btn_venda') {
      const modal = new ModalBuilder().setCustomId('modal_venda').setTitle('🤝 REGISTRAR NOVA VENDA');

      const inputItem = new TextInputBuilder()
        .setCustomId('venda_item')
        .setLabel('Item/ID (ex: ak47, awp, glock17, box_m_556)')
        .setPlaceholder('Opções: ak47, awp, m16, sawnoff, glock17, tec9, taser...')
        .setRequired(true)
        .setStyle(TextInputStyle.Short);

      const inputQtd = new TextInputBuilder()
        .setCustomId('venda_qtd')
        .setLabel('Quantidade Vendida')
        .setPlaceholder('Ex: 1')
        .setRequired(true)
        .setStyle(TextInputStyle.Short);

      const inputDesconto = new TextInputBuilder()
        .setCustomId('venda_desconto')
        .setLabel('Desconto Aplicado (%)')
        .setPlaceholder('Sem desconto, digite: 0')
        .setRequired(true)
        .setStyle(TextInputStyle.Short);

      modal.addComponents(
        new ActionRowBuilder().addComponents(inputItem),
        new ActionRowBuilder().addComponents(inputQtd),
        new ActionRowBuilder().addComponents(inputDesconto)
      );

      await interaction.showModal(modal);
    }

    // BOTÃO: CONSULTAR ESTOQUE (Com restrição de cargo)
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

      const kitsProntos = Math.floor(db.estoqueKits / CONFIG_KITS.custo_kit);
      const embedEstoque = new EmbedBuilder()
        .setTitle('📦 CONSULTA DE ESTOQUE DETALHADA')
        .setDescription('Resumo completo das reservas estratégicas e itens sob posse da facção.')
        .addFields(
          { name: '🛠️ Aço no Estoque', value: `\`${db.estoqueAco.toLocaleString()} kg\``, inline: true },
          { name: '🌾 Farme Bruto', value: `\`${db.estoqueKits.toLocaleString()} kg\``, inline: true },
          { name: '📦 Kits de Meta Prontos', value: `\`${kitsProntos} Kits\``, inline: true }
        )
        .setColor('#a855f7')
        .setTimestamp();

      await interaction.reply({ embeds: [embedEstoque], ephemeral: true });
    }

    // BOTÃO: ADICIONAR AÇO (Abre Modal)
    if (customId === 'btn_add_aco') {
      const modal = new ModalBuilder().setCustomId('modal_add_aco').setTitle('➕ ADICIONAR AÇO AO ESTOQUE');
      const input = new TextInputBuilder()
        .setCustomId('aco_add_qtd')
        .setLabel('Quantidade de Aço Adicionada (kg)')
        .setPlaceholder('Ex: 1000')
        .setRequired(true)
        .setStyle(TextInputStyle.Short);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    // BOTÃO: REMOVER AÇO (Abre Modal)
    if (customId === 'btn_sub_aco') {
      const modal = new ModalBuilder().setCustomId('modal_sub_aco').setTitle('➖ REMOVER AÇO DO ESTOQUE');
      const input = new TextInputBuilder()
        .setCustomId('aco_sub_qtd')
        .setLabel('Quantidade de Aço Removida (kg)')
        .setPlaceholder('Ex: 500')
        .setRequired(true)
        .setStyle(TextInputStyle.Short);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }
  }

  // ==========================================
  // PROCESSAMENTO DE SUBMISSÃO DE MODAIS
  // ==========================================
  if (interaction.type === InteractionType.ModalSubmit) {
    const { customId, user } = interaction;

    // MODAL: REGISTRAR FARME
    if (customId === 'modal_farme') {
      const qtdInput = interaction.fields.getTextInputValue('farme_quantidade');
      const quantidade = parseInt(qtdInput);

      if (isNaN(quantidade) || quantidade <= 0) {
        return interaction.reply({ content: '❌ **Quantidade inválida!** Digite apenas números positivos.', ephemeral: true });
      }

      await postToERP('farme', {
        userId: user.id,
        userName: user.username,
        quantidade: quantidade
      });

      const logEmbed = new EmbedBuilder()
        .setTitle('🌾 NOVO FARME ENTREGUE')
        .setDescription(`Um membro registrou uma nova entrega de farme ao galpão!`)
        .addFields(
          { name: '👤 Farmador', value: `<@${user.id}> (${user.username})`, inline: true },
          { name: '📦 Quantidade', value: `**${quantidade.toLocaleString()} kg**`, inline: true },
          { name: '🔄 Novo Saldo total', value: `**${db.estoqueKits.toLocaleString()} kg**`, inline: true }
        )
        .setColor('#10b981')
        .setTimestamp();

      await interaction.reply({ content: '✅ Farme registrado com sucesso!', ephemeral: true });

      // Enviar no canal de logs ou canal atual
      await interaction.channel.send({ embeds: [logEmbed] });
    }

    // MODAL: REGISTRAR VENDA
    if (customId === 'modal_venda') {
      const weaponKey = interaction.fields.getTextInputValue('venda_item').toLowerCase().trim();
      const qtdInput = interaction.fields.getTextInputValue('venda_qtd');
      const descontoInput = interaction.fields.getTextInputValue('venda_desconto');

      const quantidade = parseInt(qtdInput);
      const desconto = parseFloat(descontoInput);

      const arma = ARMAS[weaponKey];
      if (!arma) {
        return interaction.reply({
          content: '❌ **Erro:** Item/Arma inválida! Opções: `ak47`, `awp`, `m16`, `sawnoff`, `glock17`, `tec9`, `taser`, `silenciador`, `carregador_est`, `grip`, `lanterna`, `box_m_pistola`, `box_m_sub`, `box_m_escopeta`, `box_m_556`, `box_m_308`, `municao_pistola_10x`, `municao_smg_10x`, `municao_escopeta_10x`, `municao_fuzil_10x`.',
          ephemeral: true
        });
      }

      if (isNaN(quantidade) || quantidade <= 0) {
        return interaction.reply({ content: '❌ **Quantidade inválida!** Digite apenas números inteiros maiores que zero.', ephemeral: true });
      }

      if (isNaN(desconto) || desconto < 0 || desconto > 100) {
        return interaction.reply({ content: '❌ **Desconto inválido!** Digite um valor entre 0 e 100.', ephemeral: true });
      }

      const totalAcoNecessario = arma.aco * quantidade;
      if (db.estoqueAco < totalAcoNecessario) {
        return interaction.reply({
          content: `❌ **Aço Insuficiente!** O estoque possui apenas \`${db.estoqueAco} kg\` mas esta venda exige \`${totalAcoNecessario} kg\` de aço para fabricação.`,
          ephemeral: true
        });
      }

      const totalSemDesconto = arma.preco * quantidade;
      const totalComDesconto = totalSemDesconto * (1 - desconto / 100);
      const comissaoVendedor = totalComDesconto * 0.30; // 30% comissão

      await postToERP('venda', {
        userId: user.id,
        userName: user.username,
        itemNome: arma.nome,
        quantidade: quantidade,
        desconto: desconto,
        precoUnitario: arma.preco,
        acoUnitario: arma.aco
      });

      const vendaEmbed = new EmbedBuilder()
        .setTitle('💰 NOVA VENDA REGISTRADA')
        .setDescription(`Transação de material bélico realizada com sucesso!`)
        .addFields(
          { name: '👤 Vendedor', value: `<@${user.id}>`, inline: true },
          { name: '⚔️ Item', value: `${arma.nome} (x${quantidade})`, inline: true },
          { name: '🏷️ Desconto', value: `${desconto}%`, inline: true },
          { name: '💵 Valor Total', value: `**${formatBRL(totalComDesconto)}**`, inline: true },
          { name: '🪙 Comissão Vendedor (30%)', value: `**${formatBRL(comissaoVendedor)}**`, inline: true },
          { name: '⚙️ Aço Consumido', value: `**${totalAcoNecessario.toLocaleString()} kg**`, inline: true }
        )
        .setColor('#3b82f6')
        .setFooter({ text: "Hunters Arsenal • Sincronizado" })
        .setTimestamp();

      await interaction.reply({ content: '✅ Venda registrada com sucesso!', ephemeral: true });
      await interaction.channel.send({ embeds: [vendaEmbed] });
    }

    // MODAL: ADICIONAR AÇO
    if (customId === 'modal_add_aco') {
      const qtdInput = interaction.fields.getTextInputValue('aco_add_qtd');
      const quantidade = parseInt(qtdInput);

      if (isNaN(quantidade) || quantidade <= 0) {
        return interaction.reply({ content: '❌ **Quantidade inválida!** Digite apenas números inteiros positivos.', ephemeral: true });
      }

      await postToERP('add_aco', { quantidade });

      const addEmbed = new EmbedBuilder()
        .setTitle('➕ RECOMPOSIÇÃO DE AÇO')
        .setDescription(`Novas reservas de aço foram entregues no arsenal tático.`)
        .addFields(
          { name: '👤 Responsável', value: `<@${user.id}>`, inline: true },
          { name: '⚙️ Quantidade Adicionada', value: `**+${quantidade.toLocaleString()} kg**`, inline: true },
          { name: '🔄 Novo Saldo de Aço', value: `**${db.estoqueAco.toLocaleString()} kg**`, inline: true }
        )
        .setColor('#10b981')
        .setTimestamp();

      await interaction.reply({ content: '✅ Aço adicionado com sucesso!', ephemeral: true });
      await interaction.channel.send({ embeds: [addEmbed] });
    }

    // MODAL: REMOVER AÇO
    if (customId === 'modal_sub_aco') {
      const qtdInput = interaction.fields.getTextInputValue('aco_sub_qtd');
      const quantidade = parseInt(qtdInput);

      if (isNaN(quantidade) || quantidade <= 0) {
        return interaction.reply({ content: '❌ **Quantidade inválida!** Digite apenas números inteiros positivos.', ephemeral: true });
      }

      await postToERP('sub_aco', { quantidade });

      const subEmbed = new EmbedBuilder()
        .setTitle('➖ CONSUMO DE AÇO')
        .setDescription(`Reservas de aço foram retiradas do arsenal.`)
        .addFields(
          { name: '👤 Responsável', value: `<@${user.id}>`, inline: true },
          { name: '⚙️ Quantidade Retirada', value: `**-${quantidade.toLocaleString()} kg**`, inline: true },
          { name: '🔄 Novo Saldo de Aço', value: `**${db.estoqueAco.toLocaleString()} kg**`, inline: true }
        )
        .setColor('#ef4444')
        .setTimestamp();

      await interaction.reply({ content: '✅ Aço retirado com sucesso!', ephemeral: true });
      await interaction.channel.send({ embeds: [subEmbed] });
    }
  }
});

// ==========================================
// LOGIN DO BOT
// ==========================================
client.login(process.env.DISCORD_TOKEN);
