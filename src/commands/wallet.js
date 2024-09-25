const { tronWeb, encrypt } = require('../utils/tron');
const { fetchWallet, fetchAllWallets, saveWallet } = require("../service/user.service");
const { Markup } = require('telegraf');

// Función para manejar el comando wallet
async function walletCommand(ctx) {
  try {
    const userId = ctx.chat.id;

    // Buscar si el usuario ya tiene wallets registradas
    const walletResult = await fetchAllWallets(userId);

    if (walletResult.success && walletResult.wallets.length > 0) {
      // Si ya tiene wallets, mostrar las wallets y botón de "Nueva Wallet"
      const walletButtons = walletResult.wallets.map(wallet =>
        Markup.button.callback(wallet.wallet_name, `wallet_${wallet.wallet_address}`)
      );
      walletButtons.push(Markup.button.callback('New Wallet', 'new_wallet'));

      await ctx.reply('Your wallets:', Markup.inlineKeyboard(walletButtons));
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

    // Aquí deberías generar la dirección y clave privada de la wallet usando tu lógica
    const walletAddress = "GeneratedWalletAddress"; // Cambia esto por tu lógica para generar dirección
    const encryptedPrivateKey = "EncryptedPrivateKey"; // Cambia esto por tu lógica de cifrado

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
    } else {
      await ctx.reply(`Error: ${saveResult.message}`);
    }
  } else {
    await ctx.reply('Please use the /wallet command to register a new wallet.');
  }
}

// Función para manejar la selección de wallets existentes
async function handleWalletSelection(ctx) {
  try {
    const selectedWallet = ctx.match[0].split('_')[1];
    await ctx.answerCbQuery();
    await ctx.reply(`You selected wallet: ${selectedWallet}`);
  } catch (error) {
    console.error("Error handling wallet selection:", error);
  }
}

module.exports = {
  walletCommand,
  createNewWallet,
  handleWalletName,
  handleWalletSelection
};
