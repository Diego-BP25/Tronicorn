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

      // Enviar la lista de wallets junto con el botón "New Wallet"
      await ctx.replyWithMarkdown(walletMessage, {disable_web_page_preview: true, ...Markup.inlineKeyboard([
        Markup.button.callback('💳 New Wallet', 'new_wallet')
      ])
    });
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

// Función para manejar la creación de nuevas wallets
async function createNewWallet(ctx) {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('Please send the name for your new wallet:');
    ctx.session.waitingForWalletName = true;
  } catch (error) {
    console.error("Error creating new wallet:", error);
  }
}

// Función para manejar el texto cuando se espera un nombre de wallet
async function handleWalletName(ctx) {
  if (ctx.session.waitingForWalletName) {
    const walletName = ctx.message.text;
    console.log(`Nombre de wallet recibido: ${walletName}`);

    try {
      // Generar la cuenta TRON (dirección y clave privada)
      const account = await tronWeb.createAccount();
      const pkey = account.privateKey;
      const walletAddress = account.address.base58;  // Dirección pública generada
      const encryptedPrivateKey = encrypt(account.privateKey);  // Clave privada cifrada

      if (!walletAddress) {
        throw new Error("Failed to generate a valid wallet address.");
      }

      ctx.session.waitingForWalletName = false;  // Reseteamos el estado

      // Guardar la nueva wallet
      const saveResult = await saveWallet({
        id: ctx.chat.id,
        wallet_name: walletName,
        wallet_address: walletAddress,
        encryptedPrivateKey: encryptedPrivateKey
      });

      if (saveResult.success) {
        await ctx.reply(`Your wallet "${walletName}" has been successfully registered.`);
        await ctx.reply(`
          Your wallet has been created
      User id is: ${ctx.chat.id}
      Your new TRON address is: ${walletAddress}
      Your encrypted private key is: ${encryptedPrivateKey}

      Make sure to securely store your private keymong
      ---------------------------------------------------
      ===================================================
      Private Key: ${pkey}
        `);
      } else {
        await ctx.reply(`Error: ${saveResult.message}`);
      }
    } catch (error) {
      console.error("Error generating wallet or saving to database:", error);
      await ctx.reply("An error occurred while creating your wallet.");
    }
  } 
}

module.exports = {
  walletCommand,
  createNewWallet,
  handleWalletName
};
