const { Markup, Telegraf  } = require('telegraf');
const { fetchAllWallets, fetch_Private_key } = require("../service/user.service");
const QRCode = require('qrcode');


async function stableCoins(ctx) {
  try {
    // Opciones de tipo de swap como botones
    const swapOptions = [
      [Markup.button.callback("📥 Receive payment", `receive_payment`)],
      [Markup.button.callback("📤 Send payment", `send_payment`)]
    ];
    await ctx.reply('Select the action you want to perform:', Markup.inlineKeyboard(swapOptions));
  } catch (error) {
    console.error("Error choosing action:", error);
    await ctx.reply("Sorry, an error occurred while selecting the action.");
  }
}


async function listUserWallets(ctx) {
    try {
      const userId = ctx.chat.id;
      const walletResult = await fetchAllWallets(userId);
  
      if (walletResult.success && walletResult.wallets.length > 0) {
        const walletButtons = walletResult.wallets.map(wallet => {
          return [Markup.button.callback(wallet.wallet_name, `select_wallet_${wallet.wallet_address}`)];
        });
  
        walletButtons.push([Markup.button.callback('❌ Close', 'close')]);
  
        await ctx.reply(
          '🧾 Choose a wallet:',
          Markup.inlineKeyboard(walletButtons)
        );
      } else {
        await ctx.reply("❗ You don't have any registered wallets.");
      }
    } catch (error) {
      console.error("Error loading wallets:", error);
      ctx.reply("⚠️ An error occurred while fetching your wallets.");
    }
  }

async function handleReceive(ctx, walletAddress) {
  try {
    const qrBuffer = await QRCode.toBuffer(walletAddress, { width: 300 });

    await ctx.replyWithPhoto({ source: qrBuffer }, {
      caption: `📥 *Receive USDT*\n\`${walletAddress}\`\nScan to pay.`,
      parse_mode: "Markdown"
    });
  } catch (err) {
    console.error("QR error:", err);
    await ctx.reply("❌ Could not generate QR.");
  }
}

async function handleSend(ctx, walletAddress) {
  ctx.session.selectedWallet = walletAddress;
  ctx.session.awaitingRecipient = true;
  await ctx.reply("✉️ Enter the recipient wallet address:");
}
  

module.exports = {
    stableCoins,
    listUserWallets,
    handleReceive, 
    handleSend
}