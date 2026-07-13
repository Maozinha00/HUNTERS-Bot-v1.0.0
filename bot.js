/**
 * CLÃ HUNTERS - ENTRY POINT REDIRECT
 * Redireciona a inicialização do Node para o arquivo real do bot (bot.js).
 * Isso garante compatibilidade com hospedagens que rodam "node index.js" por padrão.
 */

require('./bot.js');
