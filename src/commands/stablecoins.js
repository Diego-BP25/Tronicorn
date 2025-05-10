const { Markup, Telegraf  } = require('telegraf');
const { replyWithPhotoFlow} = require('../utils/messageFlow');
const { fetchAllWallets} = require("../service/user.service");
const QRCode = require('qrcode');
const Jimp = require('jimp');
const path = require('path');
const { clearAllSessionFlows } = require('./clearSessions');


async function desarrollo (ctx){
    await ctx.reply('🚧 This feature is in development. Coming soon available!');
}

async function stableCoins(ctx) {
  try {
    ctx.session.messageFlow = [];
    clearAllSessionFlows(ctx);
    // Opciones de tipo de swap como botones
    await replyWithFlow(ctx, 'Select the action you want to perform:', Markup.inlineKeyboard([
        [Markup.button.callback("💼 ⬅️ Receive payment", `receive_payment`)],
        [Markup.button.callback("💼 ➡️ Send payment", `send_payment`)],
        [Markup.button.callback("❌ Cancel", "cancel_flow")]
      ]));
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
        // Mostrar todas las wallets en una sola fila (máximo 3)
        const walletRow = walletResult.wallets.map(wallet =>
          Markup.button.callback(wallet.wallet_name, `select_wallet_${wallet.wallet_address}`)
        );
  
        const keyboard = [
          walletRow, // Todas las wallets en una sola fila
          [Markup.button.callback('🔗 Link Wallet', 'external_wallet')], // Botón debajo
          [Markup.button.callback("❌ Cancel", "cancel_flow")]
        ];
  
        await replyWithFlow(ctx, 'Choose a wallet:', Markup.inlineKeyboard(keyboard));

      } else {
        await ctx.reply("❗ You don't have any registered wallets.");
      }
    } catch (error) {
      console.error("Error loading wallets:", error);
      ctx.reply("⚠️ An error occurred while fetching your wallets.");
    }
  }

  
  // En stablecoins.js
async function handleExternalWalletInput(ctx) {
    const walletAddress = ctx.message.text;
    ctx.session.awaitingExternalWallet = false;
  
    if (ctx.session.transferMode === 'receive') {
      await handleReceive(ctx, walletAddress); // Llama tu función que genera el QR
    } else {
      ctx.session.selectedWallet = walletAddress;
      ctx.session.awaitingRecipient = true;
      await ctx.reply("✉️ Enter the recipient wallet address:");
    }
  }  

  async function handleReceive(ctx, walletAddress) {
    try {
      const qrBuffer = await QRCode.toBuffer(walletAddress, { width: 400 });
  
      await replyWithPhotoFlow(ctx, { source: qrBuffer }, {
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
    handleSend,
    handleExternalWalletInput,
    desarrollo
}