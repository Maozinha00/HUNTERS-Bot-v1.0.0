/**
 * 🐺 CLÃ HUNTERS - DISCORD BOT ERP STANDALONE v5.0 (CORRIGIDO & OFICIAL)
 * 
 * 🔧 CORREÇÃO DE BUGS APLICADA:
 * - Todos os 7 botões do painel agora possuem modais e respostas instantâneas (<3s).
 * - Corrigido o erro "HUNTERS Bot não respondeu a tempo".
 * 
 * Requisitos:
 * npm install discord.js dotenv
 */

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
  InteractionType,
  ActivityType,
  PermissionFlagsBits
} from 'discord.js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// CONFIGURAÇÃO DOS CANAIS E CARGOS DO SERVIDOR
const CONFIG = {
  PREFIX: '!',
  CANAL_REGRAS_ID: '1522910276268069025',
  CANAL_LOG_METAS_ID: '1525698045537161226',
  CANAL_PAINEL_ID: '1523844178151473193',
  CARGO_RECRUTA_ID: '1515125826780135485',
  CARGO_GERENTE_ID: '1523277774436171796',
  META_ACO_KG: 8000,
  CUSTO_ACO_POR_KG: 4.5,
  SPLIT_CLAN_PERCENT: 30
};

// ESTADO GLOBAL DO BANCO E PERSISTÊNCIA LOCAL
const DB_FILE = './hunters-db.json';

let db = {
  bancoDinheiro: 868392.00,
  estoque: {
    acoBau: 69000,
    acoMaoTotal: 12500,
    kitsMontados: 8
  },
  vendas: [],
  farmes: [],
  retiradas: [],
  recrutamentos: [],
  membrosData: {}, // { discordId: { farmeSemana: 0, vendas: 0 } }
  painelCanalId: null,
  painelMensagemId: null
};

function carregarBanco() {
  if (fs.existsSync(DB_FILE)) {
    try {
      db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) };
      console.log('📂 Banco de dados local carregado com sucesso!');
    } catch (e) {
      console.error('Erro ao ler hunters-db.json:', e);
    }
  } else {
    salvarBanco();
  }
}

function salvarBanco() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error('Erro ao salvar hunters-db.json:', e);
  }
}

const formatarMoeda = (val) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const formatarNumero = (val) =>
  new Intl.NumberFormat('pt-BR').format(val || 0);

// CLIENTE DISCORD
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// LOGS DISCORD EMBED
async function registrarLogDiscord(guild, titulo, descricao, campos = [], cor = 0xa855f7) {
  try {
    const canalLogId = CONFIG.CANAL_LOG_METAS_ID;
    const canalLog =
      guild.channels.cache.get(canalLogId) ||
      (await guild.channels.fetch(canalLogId).catch(() => null));

    if (canalLog) {
      const embed = new EmbedBuilder()
        .setTitle(titulo)
        .setColor(cor)
        .setDescription(descricao)
        .addFields(campos)
        .setFooter({ text: 'Hunters ERP • Logs Oficiais' })
        .setTimestamp();

      await canalLog.send({
        content: '🚨 **REGISTRO HUNTERS ERP - LOGS**',
        embeds: [embed]
      });
    }
  } catch (e) {
    console.error('Erro ao enviar log no Discord:', e);
  }
}

// ATUALIZAR PAINEL DISCORD
async function atualizarPainel(guild) {
  try {
    const canalId = db.painelCanalId || CONFIG.CANAL_PAINEL_ID;
    const canal =
      guild.channels.cache.get(canalId) ||
      (await guild.channels.fetch(canalId).catch(() => null));

    if (!canal) return;

    const totalFarmado = db.farmes.reduce((acc, f) => acc + (f.quantidade || 0), 0);
    const totalVendidoBruto = db.vendas.reduce((acc, v) => acc + (v.valorTotalBruto || 0), 0);
    const totalLucroLiquido = db.vendas.reduce((acc, v) => acc + (v.lucroLiquidoClan || 0), 0);

    const embed = new EmbedBuilder()
      .setTitle('🐺 HUNTERS LOGÍSTICA & CONTROLE TÁTICO DE ESTOQUE')
      .setColor('#a855f7')
      .setDescription(
        [
          '```',
          '╔═══════════════════════════════════════════════════════════════╗',
          '║ 🐺 HUNTERS ERP - PAINEL TÁTICO CENTRAL DE ESTOQUE & DADOS ║',
          '╚═══════════════════════════════════════════════════════════════╝',
          `💵 BANCO DE DINHEIRO: ......... ${formatarMoeda(db.bancoDinheiro)}`,
          `📦 AÇO NO BAÚ (COFRE): ........ ${formatarNumero(db.estoque.acoBau)} kg`,
          `✋ AÇO NA MÃO (MEMBROS): ....... ${formatarNumero(db.estoque.acoMaoTotal)} kg`,
          `🔥 KITS MONTADOS PRONTOS: ...... ${db.estoque.kitsMontados} Kits Completos`,
          `📈 FATURAMENTO BRUTO: .......... ${formatarMoeda(totalVendidoBruto)}`,
          `🟢 LUCRO LÍQUIDO DO CLÃ: ....... ${formatarMoeda(totalLucroLiquido)}`,
          `🌾 TOTAL DE AÇO FARMADO: ....... ${formatarNumero(totalFarmado)} kg`,
          `🎯 META SEMANAL POR MEMBRO: .... ${formatarNumero(CONFIG.META_ACO_KG)} kg`,
          '```'
        ].join('\n')
      )
      .setFooter({ text: 'Hunters ERP • Sorte aos Fortes 🐺' })
      .setTimestamp();

    const rowAcoes = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_farme').setLabel('Entregar Farme').setStyle(ButtonStyle.Success).setEmoji('📦'),
      new ButtonBuilder().setCustomId('btn_venda').setLabel('Registrar Venda').setStyle(ButtonStyle.Primary).setEmoji('💰'),
      new ButtonBuilder().setCustomId('btn_retirar').setLabel('Retirar Aço').setStyle(ButtonStyle.Danger).setEmoji('📤'),
      new ButtonBuilder().setCustomId('btn_perfil').setLabel('Meu Perfil').setStyle(ButtonStyle.Secondary).setEmoji('👤')
    );

    const rowConsultas = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_arsenal').setLabel('Tabela de Preços').setStyle(ButtonStyle.Secondary).setEmoji('🛒'),
      new ButtonBuilder().setCustomId('btn_ranking').setLabel('Ranking').setStyle(ButtonStyle.Secondary).setEmoji('🏆'),
      new ButtonBuilder().setCustomId('btn_admin').setLabel('Painel Gerente').setStyle(ButtonStyle.Danger).setEmoji('⚙️')
    );

    const payload = { embeds: [embed], components: [rowAcoes, rowConsultas] };

    if (db.painelMensagemId) {
      try {
        const msg = await canal.messages.fetch(db.painelMensagemId);
        if (msg) return await msg.edit(payload);
      } catch (e) {}
    }

    const novaMsg = await canal.send(payload);
    db.painelCanalId = canalId;
    db.painelMensagemId = novaMsg.id;
    salvarBanco();
  } catch (err) {
    console.error('Erro ao atualizar painel:', err);
  }
}

// NOVO MEMBRO ENTRA (RECRUTAMENTO)
client.on('guildMemberAdd', async (member) => {
  try {
    const roleRecruta = member.guild.roles.cache.get(CONFIG.CARGO_RECRUTA_ID);
    if (roleRecruta) await member.roles.add(roleRecruta).catch(() => null);

    const canalRegras =
      member.guild.channels.cache.get(CONFIG.CANAL_REGRAS_ID) ||
      (await member.guild.channels.fetch(CONFIG.CANAL_REGRAS_ID).catch(() => null));

    if (canalRegras) {
      const embedWelcome = new EmbedBuilder()
        .setTitle('🐺 SEJA BEM-VINDO(A) AO CLÃ HUNTERS!')
        .setColor('#a855f7')
        .setDescription(
          `Olá <@${member.id}>! Você acaba de entrar no servidor do **CLÃ HUNTERS**! ☣️\n\n📌 Leia as regras do servidor e clique no botão abaixo para confirmar a leitura.`
        )
        .setFooter({ text: 'Hunters Recruitment' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_regras_aceitar')
          .setLabel('Li e Aceito as Regras')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅')
      );

      await canalRegras.send({
        content: `🚨 **NOVO RECRUTA!** <@${member.id}> <@&${CONFIG.CARGO_GERENTE_ID}>`,
        embeds: [embedWelcome],
        components: [row]
      });
    }
  } catch (e) {
    console.error('Erro no guildMemberAdd:', e);
  }
});

// INTERAÇÕES DOS BOTÕES E MODAIS (TODOS OS BOTÕES TRATADOS <3s)
client.on('interactionCreate', async (interaction) => {
  try {
    const { user, guild, member } = interaction;
    if (!guild) return;

    // VERIFICADOR DE PERMISSÃO DE GERENTE
    const isManager = () => {
      return (
        member?.roles?.cache?.has(CONFIG.CARGO_GERENTE_ID) ||
        member?.permissions?.has(PermissionFlagsBits.Administrator) ||
        member?.permissions?.has(PermissionFlagsBits.ManageGuild)
      );
    };

    // --- INTERAÇÃO DE BOTÕES ---
    if (interaction.isButton()) {
      // 1. REGRAS
      if (interaction.customId === 'btn_regras_aceitar') {
        await interaction.deferReply({ ephemeral: true });
        await interaction.editReply({ content: '✅ **Regras Oficiais Confirmadas com Sucesso! Seja bem-vindo ao Clã!**' });
        await registrarLogDiscord(
          guild,
          '✅ CONFIRMAÇÃO DE REGRAS',
          `Membro <@${user.id}> confirmou as regras do Clã.`,
          [],
          0x10b981
        );
        return;
      }

      // 2. ENTREGAR FARME (btn_farme) -> MODAL
      if (interaction.customId === 'btn_farme') {
        const modal = new ModalBuilder()
          .setCustomId('modal_farme')
          .setTitle('📦 Entregar Farme de Aço');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('farme_qtd')
              .setLabel('Quantidade de Aço (kg)')
              .setPlaceholder('Ex: 2500')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('farme_destino')
              .setLabel('Destino (bau ou mao)')
              .setValue('bau')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );

        return await interaction.showModal(modal);
      }

      // 3. REGISTRAR VENDA (btn_venda) -> MODAL
      if (interaction.customId === 'btn_venda') {
        const modal = new ModalBuilder()
          .setCustomId('modal_venda')
          .setTitle('💰 Registrar Venda Tática');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('venda_item')
              .setLabel('Item Vendido')
              .setPlaceholder('Ex: Kit Completo / Aço / AK-47')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('venda_valor')
              .setLabel('Valor Total Bruto (R$)')
              .setPlaceholder('Ex: 15000')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );

        return await interaction.showModal(modal);
      }

      // 4. RETIRAR AÇO (btn_retirar) -> MODAL
      if (interaction.customId === 'btn_retirar') {
        const modal = new ModalBuilder()
          .setCustomId('modal_retirar')
          .setTitle('📤 Retirar Aço do Cofre');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('retirar_qtd')
              .setLabel('Quantidade a Retirar (kg)')
              .setPlaceholder('Ex: 1000')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('retirar_motivo')
              .setLabel('Motivo da Retirada')
              .setPlaceholder('Ex: Ação de Guerra / Produção de Kits')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );

        return await interaction.showModal(modal);
      }

      // 5. MEU PERFIL (btn_perfil) -> RESPOSTA EPHEMERAL
      if (interaction.customId === 'btn_perfil') {
        await interaction.deferReply({ ephemeral: true });

        const userData = db.membrosData[user.id] || { farmeSemana: 0, vendas: 0 };
        const metaProgresso = Math.min(100, Math.round((userData.farmeSemana / CONFIG.META_ACO_KG) * 100));
        const statusMeta = userData.farmeSemana >= CONFIG.META_ACO_KG ? '✅ META BATIDA!' : '⏳ PENDENTE';

        const embedPerfil = new EmbedBuilder()
          .setTitle(`👤 PERFIL TÁTICO DE ${user.username.toUpperCase()}`)
          .setColor(userData.farmeSemana >= CONFIG.META_ACO_KG ? 0x10b981 : 0xf59e0b)
          .setThumbnail(user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: '🌾 Aço Farmado na Semana', value: `${formatarNumero(userData.farmeSemana)} kg / ${formatarNumero(CONFIG.META_ACO_KG)} kg (${metaProgresso}%)`, inline: false },
            { name: '🎯 Status da Meta Semanal', value: statusMeta, inline: true },
            { name: '💰 Vendas Acumuladas', value: formatarMoeda(userData.vendas), inline: true },
            { name: '🏷️ Cargo no Servidor', value: member.roles.highest.name, inline: false }
          )
          .setFooter({ text: 'Hunters ERP • Perfil Individual' })
          .setTimestamp();

        return await interaction.editReply({ embeds: [embedPerfil] });
      }

      // 6. TABELA DE PREÇOS (btn_arsenal) -> RESPOSTA EPHEMERAL
      if (interaction.customId === 'btn_arsenal') {
        await interaction.deferReply({ ephemeral: true });

        const embedArsenal = new EmbedBuilder()
          .setTitle('🛒 TABELA OFICIAL DE VALORES DE PEÇAS & ARMAS (EM AÇO)')
          .setColor('#3b82f6')
          .setDescription(
            [
              '```',
              '• $750 kg Aço: M240',
              '• $600 kg Aço: PKM',
              '• $300 kg Aço: Bandoleira AK, Bipé/Cano/Coronha/Ferrolho/Tambor M240/PKM, Mola LMG',
              '• $250 kg Aço: AK Draco',
              '• $170 kg Aço: Cabo, Cano, Carregador, Gatilho CR-527',
              '• $120 kg Aço: AK Draco (Apoio, Cano, Coronha, Punho)',
              '• $100 kg Aço: Micro Uzi, MP5, Sawnoff Shotgun',
              '• $80 kg Aço:  DB Shotgun',
              '• $50 kg Aço:  Colt 1851 Navy, Colt M1878, Glock-17, Coronha/Trabuco',
              '• $40 kg Aço:  Carregador, Cabo, Gatilho Tec SMG',
              '• $30 kg Aço:  Makarov, Cano/Coronha/Ferrolho Shotgun',
              '• $15 kg Aço:  Cabos, Canos, Tambores de Relíquias & Tec SMG',
              '```',
              `*Nota: Em todas as vendas, ${CONFIG.SPLIT_CLAN_PERCENT}% do valor vai para o Banco do Clã e ${100 - CONFIG.SPLIT_CLAN_PERCENT}% vai para o vendedor (Custo Aço R$ ${CONFIG.CUSTO_ACO_POR_KG.toFixed(2)}/kg).*`,
            ].join('\n')
          )
          .setFooter({ text: 'Hunters ERP • Tabela Tática de Peças em Aço' });

        return await interaction.editReply({ embeds: [embedArsenal] });
      }

      // 7. RANKING (btn_ranking) -> RESPOSTA EPHEMERAL
      if (interaction.customId === 'btn_ranking') {
        await interaction.deferReply({ ephemeral: true });

        const farmesOrdenados = [...db.farmes]
          .sort((a, b) => b.quantidade - a.quantidade)
          .slice(0, 5);

        let descRanking = '🏆 **TOP 5 FARMADORES DE AÇO DO CLÃ**\n\n';
        if (farmesOrdenados.length === 0) {
          descRanking += '_Nenhum farme registrado ainda esta semana._';
        } else {
          farmesOrdenados.forEach((f, idx) => {
            const medalha = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🎖️';
            descRanking += `${medalha} **${idx + 1}º lugar:** ${f.memberName} — **${formatarNumero(f.quantidade)} kg**\n`;
          });
        }

        const embedRanking = new EmbedBuilder()
          .setTitle('🏆 RANKING TÁTICO HUNTERS')
          .setColor('#eab308')
          .setDescription(descRanking)
          .setFooter({ text: 'Hunters ERP • Ranking Semanal' });

        return await interaction.editReply({ embeds: [embedRanking] });
      }

      // 8. PAINEL GERENTE (btn_admin) -> MODAL (APENAS GERENTES)
      if (interaction.customId === 'btn_admin') {
        if (!isManager()) {
          return await interaction.reply({
            content: `❌ **Acesso Negado ao Painel Gerencial!**\nVocê precisa do cargo <@&${CONFIG.CARGO_GERENTE_ID}> ou permissão de Administrador.`,
            ephemeral: true
          });
        }

        const modal = new ModalBuilder()
          .setCustomId('modal_admin')
          .setTitle('⚙️ Painel Gerencial • Ajustes');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('admin_banco')
              .setLabel('Banco (R$)')
              .setValue(String(db.bancoDinheiro))
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('admin_acobau')
              .setLabel('Aço Baú (kg)')
              .setValue(String(db.estoque.acoBau))
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('admin_acomao')
              .setLabel('Aço Mão (kg)')
              .setValue(String(db.estoque.acoMaoTotal))
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('admin_kits')
              .setLabel('Kits Montados')
              .setValue(String(db.estoque.kitsMontados))
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );

        return await interaction.showModal(modal);
      }
    }

    // --- INTERAÇÃO DE MODAIS (SUBMIT) ---
    if (interaction.type === InteractionType.ModalSubmit) {
      // 1. MODAL ENTREGA DE FARME
      if (interaction.customId === 'modal_farme') {
        await interaction.deferReply({ ephemeral: true });

        const qtd = parseInt(interaction.fields.getTextInputValue('farme_qtd')) || 0;
        const destino = interaction.fields.getTextInputValue('farme_destino').toLowerCase() === 'mao' ? 'mao' : 'bau';

        if (qtd <= 0) {
          return await interaction.editReply({ content: '❌ Quantidade de farme inválida!' });
        }

        if (destino === 'bau') {
          db.estoque.acoBau += qtd;
        } else {
          db.estoque.acoMaoTotal += qtd;
        }

        // Salvar estatísticas do membro
        if (!db.membrosData[user.id]) db.membrosData[user.id] = { farmeSemana: 0, vendas: 0 };
        db.membrosData[user.id].farmeSemana += qtd;

        db.farmes.push({
          id: Date.now().toString(),
          memberId: user.id,
          memberName: user.username,
          quantidade: qtd,
          destino,
          data: new Date().toLocaleString('pt-BR')
        });

        salvarBanco();
        await interaction.editReply({ content: `📦 **Farme de ${formatarNumero(qtd)} kg de Aço entregue com sucesso no ${destino.toUpperCase()}!**` });
        await registrarLogDiscord(
          guild,
          '📦 NOVO FARME ENTREGUE',
          `O membro <@${user.id}> entregou **${formatarNumero(qtd)} kg** de Aço no **${destino.toUpperCase()}**.`,
          [
            { name: 'Membro', value: user.username, inline: true },
            { name: 'Quantidade', value: `${formatarNumero(qtd)} kg`, inline: true },
            { name: 'Destino', value: destino.toUpperCase(), inline: true }
          ],
          0x10b981
        );

        await atualizarPainel(guild);
        return;
      }

      // 2. MODAL REGISTRO DE VENDA
      if (interaction.customId === 'modal_venda') {
        await interaction.deferReply({ ephemeral: true });

        const item = interaction.fields.getTextInputValue('venda_item') || 'Item Geral';
        const valorBruto = parseFloat(interaction.fields.getTextInputValue('venda_valor')) || 0;

        if (valorBruto <= 0) {
          return await interaction.editReply({ content: '❌ Valor de venda inválido!' });
        }

        const lucroClan = (valorBruto * CONFIG.SPLIT_CLAN_PERCENT) / 100;
        const lucroMembro = valorBruto - lucroClan;

        db.bancoDinheiro += lucroClan;

        if (!db.membrosData[user.id]) db.membrosData[user.id] = { farmeSemana: 0, vendas: 0 };
        db.membrosData[user.id].vendas += valorBruto;

        db.vendas.push({
          id: Date.now().toString(),
          memberId: user.id,
          memberName: user.username,
          item,
          valorTotalBruto: valorBruto,
          lucroLiquidoClan: lucroClan,
          lucroMembro,
          data: new Date().toLocaleString('pt-BR')
        });

        salvarBanco();
        await interaction.editReply({
          content: `💰 **Venda registrada com sucesso!**\n• Valor Bruto: ${formatarMoeda(valorBruto)}\n• Depósito Clã (${CONFIG.SPLIT_CLAN_PERCENT}%): ${formatarMoeda(lucroClan)}\n• Seu Pagamento (${100 - CONFIG.SPLIT_CLAN_PERCENT}%): ${formatarMoeda(lucroMembro)}`
        });

        await registrarLogDiscord(
          guild,
          '💰 NOVA VENDA REGISTRADA',
          `Venda efetuada por <@${user.id}>.\n**Item:** ${item}`,
          [
            { name: 'Valor Total', value: formatarMoeda(valorBruto), inline: true },
            { name: 'Lucro Clã (30%)', value: formatarMoeda(lucroClan), inline: true },
            { name: 'Lucro Membro (70%)', value: formatarMoeda(lucroMembro), inline: true }
          ],
          0x3b82f6
        );

        await atualizarPainel(guild);
        return;
      }

      // 3. MODAL RETIRADA DE AÇO
      if (interaction.customId === 'modal_retirar') {
        await interaction.deferReply({ ephemeral: true });

        const qtd = parseInt(interaction.fields.getTextInputValue('retirar_qtd')) || 0;
        const motivo = interaction.fields.getTextInputValue('retirar_motivo') || 'Sem motivo';

        if (qtd <= 0 || qtd > db.estoque.acoBau) {
          return await interaction.editReply({
            content: `❌ Quantidade inválida ou insuficiente no baú! Disponível: ${formatarNumero(db.estoque.acoBau)} kg`
          });
        }

        db.estoque.acoBau -= qtd;
        db.estoque.acoMaoTotal += qtd;

        db.retiradas.push({
          id: Date.now().toString(),
          memberId: user.id,
          memberName: user.username,
          quantidade: qtd,
          motivo,
          data: new Date().toLocaleString('pt-BR')
        });

        salvarBanco();
        await interaction.editReply({
          content: `📤 **Retirada de ${formatarNumero(qtd)} kg efetuada com sucesso!**\nMotivo: ${motivo}`
        });

        await registrarLogDiscord(
          guild,
          '📤 RETIRADA DE AÇO DO BAÚ',
          `<@${user.id}> retirou **${formatarNumero(qtd)} kg** de Aço do Cofre do Clã.`,
          [
            { name: 'Solicitante', value: user.username, inline: true },
            { name: 'Quantidade', value: `${formatarNumero(qtd)} kg`, inline: true },
            { name: 'Motivo', value: motivo, inline: false }
          ],
          0xef4444
        );

        await atualizarPainel(guild);
        return;
      }

      // 4. MODAL PAINEL GERENTE
      if (interaction.customId === 'modal_admin') {
        if (!isManager()) {
          return await interaction.reply({ content: '❌ **Acesso Negado!**', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        db.bancoDinheiro = parseFloat(interaction.fields.getTextInputValue('admin_banco')) || db.bancoDinheiro;
        db.estoque.acoBau = parseInt(interaction.fields.getTextInputValue('admin_acobau')) || db.estoque.acoBau;
        db.estoque.acoMaoTotal = parseInt(interaction.fields.getTextInputValue('admin_acomao')) || db.estoque.acoMaoTotal;
        db.estoque.kitsMontados = parseInt(interaction.fields.getTextInputValue('admin_kits')) || db.estoque.kitsMontados;

        salvarBanco();
        await interaction.editReply({ content: '⚙️ **Alterações Gerenciais Salvas com Sucesso!**' });

        await registrarLogDiscord(
          guild,
          '⚙️ AJUSTE GERENCIAL REALIZADO',
          `O Gerente <@${user.id}> alterou manualmente os valores do Estoque/Banco.`,
          [
            { name: 'Novo Banco', value: formatarMoeda(db.bancoDinheiro), inline: true },
            { name: 'Aço Baú', value: `${formatarNumero(db.estoque.acoBau)} kg`, inline: true },
            { name: 'Kits Montados', value: String(db.estoque.kitsMontados), inline: true }
          ],
          0xa855f7
        );

        await atualizarPainel(guild);
        return;
      }
    }
  } catch (error) {
    console.error('Erro na execução da interação:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '⚠️ **Ocorreu um erro ao processar esta ação! Tente novamente.**',
        ephemeral: true
      }).catch(() => null);
    }
  }
});

// INICIALIZAÇÃO
client.once('ready', () => {
  console.log(`🤖 Bot Clã Hunters Online como ${client.user.tag}!`);
  client.user.setActivity('Hunters ERP • Logística Tática', { type: ActivityType.Playing });
  carregarBanco();
  client.guilds.cache.forEach((guild) => atualizarPainel(guild));
});

client.login(process.env.DISCORD_TOKEN);
