const { Markup } = require('telegraf');

async function startCommand(ctx) {
  try {
    await ctx.reply(
'Welcome to the TRON Bot! Choose an option:',
      Markup.inlineKeyboard([
        [Markup.button.callback(`🔐 *Wallet Management*`, '')],
        [Markup.button.callback('💼 Wallet', 'wallet'), Markup.button.callback('💰 Balance', 'balance'), Markup.button.callback('🌐 Link Wallet', 'external')],
        [Markup.button.callback(`🔄  *Trading Tools*`, '')],
        [Markup.button.callback('🔁 Swap Tokens', 'swap'), Markup.button.callback('🎯 Sniper', 'sniper')],
        [Markup.button.callback(`💸 *Transfers*`, '')],
        [Markup.button.callback('🚀 Transfer TRX', 'transfer')],
        [Markup.button.callback(`💵 *Stable Assets*`, '')],
        [Markup.button.callback('🪙 StableCoins', 'stableCoins')]
      ])
    );    
  } catch (error) {
    console.error("Error showing menu:", error);
    await ctx.reply("❌ Error showing menu.");
  }
}

module.exports = { startCommand };
