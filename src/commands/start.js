const { Markup } = require('telegraf');

async function startCommand(ctx) {
  try {
    const menuText = `
🔐 *Wallet Management*
💼 Wallet        💰 Balance
🌐 Link Wallet

🔄 *Trading Tools*
🔁 Swap Tokens   🎯 Sniper

💸 *Transfers*
🚀 Transfer TRX

💵 *Stable Assets*
🪙 StableCoins
    `;

    await ctx.reply(
      menuText,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💼 Wallet', 'wallet'), Markup.button.callback('💰 Balance', 'balance')],
          [Markup.button.callback('🌐 Link Wallet', 'external')],
          [Markup.button.callback('🔁 Swap Tokens', 'swap'), Markup.button.callback('🎯 Sniper', 'sniper')],
          [Markup.button.callback('🚀 Transfer TRX', 'transfer')],
          [Markup.button.callback('🪙 StableCoins', 'stableCoins')],
        ])
      }
    );

  } catch (error) {
    console.error("❌ Error displaying menu:", error);
    await ctx.reply("⚠️ Something went wrong while showing the menu.");
  }
}

module.exports = {
  startCommand
};
