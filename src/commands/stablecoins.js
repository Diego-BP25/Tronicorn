const { Markup, Telegraf  } = require('telegraf');
const { fetchAllWallets} = require("../service/user.service");
const QRCode = require('qrcode');
const Jimp = require('jimp');
const path = require('path');


async function stableCoins(ctx) {
  try {
    // Opciones de tipo de swap como botones
    const swapOptions = [
      [Markup.button.callback("💼⬅️ Receive payment", `receive_payment`)],
      [Markup.button.callback("💼➡️ Send payment", `send_payment`)]
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
          'Choose a wallet:',
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

        // 1. Generar el QR en un buffer
        const qrBuffer = await QRCode.toBuffer(walletAddress, {
          width: 400,
          margin: 2
        });
    
        // 2. Leer el QR generado como imagen
        const qrImage = await Jimp.read(qrBuffer);
    
        // 3. Cargar tu logo (ajusta el path si es necesario)
        const logoPath = path.join(__dirname, 'tronbot2_byn.png'); // Cambia el nombre si tu logo tiene otro
        const logo = await Jimp.read(logoPath);
    
        // 4. Redimensionar el logo para que encaje bien en el centro
        const logoSize = qrImage.bitmap.width * 0.3; // 20% del tamaño del QR
        logo.resize(logoSize, logoSize);
    
        // 5. Calcular posición centrada
        const x = (qrImage.bitmap.width / 2) - (logo.bitmap.width / 2);
        const y = (qrImage.bitmap.height / 2) - (logo.bitmap.height / 2);
    
        // 6. Pegar el logo sobre el QR
        qrImage.composite(logo, x, y);
    
        // 7. Obtener buffer final
        const finalBuffer = await qrImage.getBufferAsync(Jimp.MIME_PNG);
    
        // 8. Enviar el QR personalizado
        await ctx.replyWithPhoto({ source: finalBuffer }, {
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