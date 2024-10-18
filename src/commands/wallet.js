const { tronWeb, encrypt } = require('../utils/tron');
const { fetchAllWallets, saveWallet } = require("../service/user.service");
const { Markup } = require('telegraf');

// Función para manejar el comando wallet
async function walletCommand(ctx) {
  try {
    const userId = ctx.chat.id;

    // Buscar si el usuario ya tiene wallets registradas
    const walletResult = await fetchAllWallets(userId);

    if (walletResult.success && walletResult.wallets.length > 0) {
      // Si ya tiene wallets, las listamos en el formato solicitado
      let walletMessage = '';

      for (const wallet of walletResult.wallets) {
        const walletAddress = wallet.wallet_address;
        const walletName = wallet.wallet_name;
        const tronScanLink = `https://tronscan.org/#/address/${walletAddress}`;

        // Obtener el balance de cada wallet
        const balance = await tronWeb.trx.getBalance(walletAddress);
        const formattedBalance = tronWeb.fromSun(balance); // Formatear el balance a TRX

        walletMessage += `💰 *${walletName}*  • ${formattedBalance} TRX\n`;
        walletMessage += `${walletAddress}\n`;
        walletMessage += `[🌍 View on Tronscan](${tronScanLink})\n`;
        walletMessage += `\n───────────────\n\n`;  // Separador entre wallets
      }

      // Enviar la lista de wallets junto con los botones "New Wallet", "Back", y "Close"
      if (ctx.update.callback_query) {
        await ctx.editMessageText(walletMessage, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          ...Markup.inlineKeyboard([
            [Markup.button.callback('💳 New Wallet', 'new_wallet')],
            [Markup.button.callback('⬅️ Back', 'back'), Markup.button.callback('❌ Close', 'close')]
          ])
        });
      } else {
        const sentMessage = await ctx.replyWithMarkdown(walletMessage, {
          disable_web_page_preview: true,
          ...Markup.inlineKeyboard([
            [Markup.button.callback('💳 New Wallet', 'new_wallet')],
            [Markup.button.callback('⬅️ Back', 'back'), Markup.button.callback('❌ Close', 'close')]
          ])
        });

        // Guardar el message_id en la sesión para futuras ediciones
        ctx.session.messageId = sentMessage.message_id;
      }

    } else {
      // Si no tiene wallets, solicitar que ingrese un nombre para la nueva wallet
      await ctx.reply('It looks like this is your first time. Please send the name for your new wallet:');
      ctx.session.waitingForWalletName = true;  // Marcamos que estamos esperando el nombre de la wallet
    }
  } catch (error) {
    console.error("Error fetching or creating wallets:", error);
    ctx.reply("Sorry, an error occurred while fetching or creating your wallet.");
  }
}

// Función para manejar el botón "Back" (ejemplo sencillo, puedes personalizar el flujo)
async function handleBack(ctx) {
  await ctx.answerCbQuery();  // Responder el callback
  await ctx.reply('Returning to the previous step...');
}

// Función para manejar el botón "Close"
async function handleClose(ctx) {
  await ctx.answerCbQuery();  // Responder el callback
  await ctx.deleteMessage();  // Eliminar el mensaje actual
}

// Función para manejar la creación de nuevas wallets
async function createNewWallet(ctx) {
  try {
    await ctx.answerCbQuery();
    await ctx.editMessageText('Please send the name for your new wallet:');
    ctx.session.waitingForWalletName = true;
  } catch (error) {
    console.error("Error creating new wallet:", error);
  }
}

module.exports = {
  walletCommand,
  createNewWallet,
  handleBack,
  handleClose,
};
