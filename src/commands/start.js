const { Markup } = require('telegraf');

async function startCommand(ctx) {
  try {
    // 🟠 Sección: Wallet Management
    await ctx.reply(
      `🔐 *Wallet Management*`,
      { parse_mode: "Markdown" }
    );
    await ctx.reply(
      'Choose an option:',
      Markup.inlineKeyboard([
        [Markup.button.callback('💼 Wallet', 'wallet'), Markup.button.callback('💰 Balance', 'balance')],
        [Markup.button.callback('🌐 Link Wallet', 'external')]
      ])
    );

    // 🟠 Sección: Trading Tools
    await ctx.reply(
      `\n🔄 *Trading Tools*`,
      { parse_mode: "Markdown" }
    );
    await ctx.reply(
      'Choose an option:',
      Markup.inlineKeyboard([
        [Markup.button.callback('🔁 Swap Tokens', 'swap'), Markup.button.callback('🎯 Sniper', 'sniper')]
      ])
    );

    // 🟠 Sección: Transfers
    await ctx.reply(
      `\n💸 *Transfers*`,
      { parse_mode: "Markdown" }
    );
    await ctx.reply(
      'Choose an option:',
      Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Transfer TRX', 'transfer')]
      ])
    );

    // 🟠 Sección: Stable Assets
    await ctx.reply(
      `\n💵 *Stable Assets*`,
      { parse_mode: "Markdown" }
    );
    await ctx.reply(
      'Choose an option:',
      Markup.inlineKeyboard([
        [Markup.button.callback('🪙 StableCoins', 'stableCoins')]
      ])
    );

  } catch (error) {
    console.error("Error showing start menu:", error);
    await ctx.reply("❌ Sorry, an error occurred while displaying the menu.");
  }
}

module.exports = {
  startCommand
};
