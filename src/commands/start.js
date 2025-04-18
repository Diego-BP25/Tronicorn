const { Markup } = require('telegraf');

async function startCommand(ctx) {
  try {
    await ctx.replyWithMarkdown(
`🔐 *Wallet Management*`,
      Markup.inlineKeyboard([
        [Markup.button.callback('👛 Wallet', 'wallet'), Markup.button.callback('💰 Balance', 'balance')],
        [Markup.button.callback('🌐 Link Wallet', 'external')],
        [{ text: '⬇️ Más opciones', callback_data: 'more_options' }] // opcional si querés paginación
      ])
    );

    await ctx.replyWithMarkdown(
`🛠️ *Trading Tools*`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🔁 Swap Tokens', 'swap'), Markup.button.callback('🎯 Sniper', 'sniper')],
      ])
    );

    await ctx.replyWithMarkdown(
`💸 *Transfers*`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Transfer TRX', 'transfer')],
      ])
    );

    await ctx.replyWithMarkdown(
`💵 *Stable Assets*`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🪙 StableCoins', 'stableCoins')],
      ])
    );
    
  } catch (error) {
    console.error("Error showing menu:", error);
    await ctx.reply("❌ Error showing menu.");
  }
}

module.exports = { startCommand };
