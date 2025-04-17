const { Markup } = require('telegraf');
// const { balanceCommand, swapTokens, transferTRX } = require('../commands');

// Función para el comando /start que mostrará el menú interactivo
async function startCommand(ctx) {
  try {
    // Respuesta con menú interactivo
    await ctx.reply(
      'Welcome to the TRON Bot! Choose an option:',
      Markup.inlineKeyboard([
        [Markup.button.callback('💼 Wallet', 'wallet')],
        [Markup.button.callback('💰 Balance', 'balance')],
        [Markup.button.callback('🔄 Swap Tokens', 'swap')],
        [Markup.button.callback('💸 Transfer TRX', 'transfer')],
        [Markup.button.callback('🎯 Sniper', 'sniper')],
        [Markup.button.callback('🌐🔗 Link external wallet', 'external')]

      ])
    );
  } catch (error) {
    console.error("Error showing start menu:", error);
    ctx.reply("Sorry, an error occurred while displaying the menu.");
  }
};

module.exports ={
  startCommand
}