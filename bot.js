// COMANDO: AVISO META (ADICIONADO)
  if (command === 'avisometa' || command === 'geraraviso' || command === 'aviso') {
    if (!message.member.permissions.has('Administrator') && !temPermissaoEstoque(message.member)) {
      return message.reply('❌ **Acesso Negado!** Apenas administradores do clã ou membros autorizados com acesso ao estoque podem disparar este aviso.');
    }

    const canalAvisosId = '1515125864033943712';
    const cargoNotificarId = '1515125826780135485';

    let canalAvisos = client.channels.cache.get(canalAvisosId);
    if (!canalAvisos) {
      try {
        canalAvisos = await client.channels.fetch(canalAvisosId);
      } catch (e) {
        return message.reply(`❌ **Erro:** Não consegui localizar o canal de avisos com o ID \`${canalAvisosId}\`. Verifique se o bot possui acesso e permissões de leitura/escrita nele.`);
      }
    }

    const embedAviso = new EmbedBuilder()
      .setTitle('📢 AVISO DE META OBRIGATÓRIA — HUNTERS ERP')
      .setColor('#da373c')
      .setDescription(`⚠️ **ATENÇÃO MEMBROS! DIRETRIZ CRÍTICA DA FACÇÃO HUNTERS** ⚠️\n\n` +
        `⛓️ **META INDIVIDUAL OBRIGATÓRIA:**\n` +
        `É **totalmente obrigatório** farmar e registrar no mínimo **8.000 kg de aço** para ter o direito de receber o seu **Kit de Meta**.\n\n` +
        `⏱️ **PRAZO DE TOLERÂNCIA DE 3 DIAS:**\n` +
        `Atenção: quem **NÃO ENTRAR** ou não preencher seus farmes no painel dentro do período de **3 dias** para a entrega da meta será **SUMARIAMENTE RETIRADO DO PAINEL**!\n\n` +
        `🎯 **COMO PREENCHER A META:**\n` +
        `Você deve registrar seus farmes clicando no botão **Registrar Meta** do nosso painel no canal oficial:\n` +
        `👉 **Clique aqui para ir ao Canal do Painel:** <#1523844178151473193>\n` +
        `*(Membros que não preencherem estarão sujeitos à remoção das permissões de kits e gerenciamento)*\n\n` +
        `Não perca o prazo e garanta o seu kit semanal regulamentar de armamentos! Foco total na meta! ⚔️`)
      .setFooter({ text: 'Hunters ERP • Administração Hunters' })
      .setTimestamp();

    try {
      await canalAvisos.send({
        content: `🚨 **ATENÇÃO** <@&${cargoNotificarId}>! 🚨\n**AVISO IMPORTANTÍSSIMO SOBRE A META DE AÇO DOS KITS!**`,
        embeds: [embedAviso]
      });
      return message.reply(`✅ **Aviso enviado com sucesso!** A mensagem com as diretrizes e marcação foi enviada no canal de avisos <#${canalAvisosId}>.`);
    } catch (err) {
      console.error('Erro ao enviar mensagem de aviso de meta:', err);
      return message.reply(`❌ **Erro ao enviar aviso:** \`${err.message}\`. Certifique-se de que o bot possui permissão de enviar mensagens e embeds no canal <#${canalAvisosId}>.`);
    }
  }
