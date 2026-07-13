// Obter aço total de farme + vendas de um usuário específico
function obterAcoTotalUsuario(userId) {
  let total = 0;
  if (db.vendas) {
    db.vendas.forEach(v => {
      if (v.userId === userId) {
        total += (v.acoConsumido || 0);
      }
    });
  }
  if (db.farmes) {
    db.farmes.forEach(f => {
      if (f.userId === userId) {
        total += (f.quantidade || 0);
      }
    });
  }
  return total;
}

// Função auxiliar para verificar se o usuário bateu a meta de 8.000 kg e enviar o anúncio com menção ao cargo
async function checarMetaAtingida(userId, acoAntes, acoDepois, canal) {
  if (acoAntes < 8000 && acoDepois >= 8000) {
    const CARGO_NOTIFICAR_ID = '1515125826780135485';
    
    const embedComemoracao = new EmbedBuilder()
      .setTitle('🎉 META DE AÇO BATIDA! 🎉')
      .setColor('#a855f7')
      .setDescription(`🏆 **Excelente trabalho!**\n\n👤 **Membro:** <@${userId}>\n⛓️ **Total Acumulado:** **${formatarNumero(acoDepois)} kg** / 8.000 kg\n\nO membro completou com sucesso a meta de aço para a facção! 🐺`)
      .setFooter({ text: 'Hunters ERP • Meta Semanal de Aço' })
      .setTimestamp();

    if (canal) {
      await canal.send({
        content: `🚨 **ATENÇÃO** <@&${CARGO_NOTIFICAR_ID}>! 🚨\n🏆 O membro <@${userId}> acabou de bater a meta de **8.000 kg** de aço! 🎉`,
        embeds: [embedComemoracao]
      }).catch(err => {
        console.error('Erro ao enviar anúncio de meta batida:', err);
      });
    }
  }
}
