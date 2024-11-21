const { fetchAllWallets, fetch_Private_key } = require("../service/user.service");
const { Markup } = require('telegraf');
const { decrypt } = require('../utils/tron');
const TronWeb = require('tronweb');

const fullNode = 'https://api.trongrid.io';
const solidityNode = 'https://api.trongrid.io';
const eventServer = 'https://api.trongrid.io';
const routerAddress = 'TXF1xDbVGdxFGbovmmmXvBGu8ZiE3Lq4mR'; // SunSwap V2 Router

// Definir el porcentaje de comisión
const commissionRate = 0.01; // Comisión del 1%
const botAddress = 'TPB27eRk4gPcYqSh4ihqXmdWZWidB87quR'; // Dirección para recibir la comisión

// Función para manejar el comando inicial de swap
async function handleWalletSwap(ctx) {
  try {
    // Opciones de tipo de swap como botones
    const swapOptions = [
      [Markup.button.callback("TRX/Tokens", `swap_type_TRX_TOKENS`)],
      [Markup.button.callback("Tokens/TRX", `swap_type_TOKENS_TRX`)]
    ];
    await ctx.reply('Please select the type of swap:', Markup.inlineKeyboard(swapOptions));
  } catch (error) {
    console.error("Error handling wallet swap:", error);
    await ctx.reply("Sorry, an error occurred while setting up the swap options.");
  }
}

// Función para manejar el comando swap de tipo TRX a Tokens
async function swapTokens(ctx) {
  try {
    const userId = ctx.chat.id;

    // Obtener todas las wallets del usuario
    const walletResult = await fetchAllWallets(userId);

    if (walletResult.success && walletResult.wallets.length > 0) {
      // Listar las wallets del usuario como botones
      const walletButtons = walletResult.wallets.map(wallet => {
        return [Markup.button.callback(wallet.wallet_name, `swap_wallet_${wallet.wallet_address}`)];
      });

      await ctx.reply('Please select a wallet to perform the swap:', Markup.inlineKeyboard(walletButtons));
    } else {
      await ctx.reply("You don't have any registered wallets. Please create one first.");
    }
  } catch (error) {
    console.error("Error fetching wallets for swap:", error);
    ctx.reply("Sorry, an error occurred while fetching your wallets.");
  }
}

// Manejador para la selección de wallet y para solicitar la dirección del token
async function handleSwapType(ctx) {
  const callbackData = ctx.update.callback_query.data;
  const walletAddress = callbackData.replace('swap_wallet_', '');

  // Guardar la wallet en sesión y cambiar el estado
  ctx.session.fromWallet = walletAddress;

  // Recuperar la clave privada cifrada de la wallet
  const userId = ctx.chat.id;
  const privateKeyResult = await fetch_Private_key(userId, walletAddress);

  if (privateKeyResult.success) { 
    // Almacena la clave privada cifrada en la sesión
    ctx.session.swapData = {
      encryptedPrivateKey: privateKeyResult.encryptedPrivateKey,
      walletAddress
    };
    
    await ctx.reply("Please enter the token address you want to swap:");
    ctx.session.awaitingTokenAddress = true; // Marca que estamos esperando la dirección del token
  } else {
    await ctx.reply("Could not fetch the private key for this wallet. Please check your wallet details.");
  }
}

// Función para procesar el token de destino
async function handleTokenAddress(ctx) {
  if (ctx.session.awaitingTokenAddress) {
    ctx.session.swapData.tokenAddress = ctx.message.text;
    ctx.session.awaitingTokenAddress = false; // Resetea la espera
    await ctx.reply("Please enter the amount of TRX to swap:");
    ctx.session.awaitingTrxAmount = true; // Marca que estamos esperando el monto
  }
}

// Función para procesar el monto de TRX
async function handleTrxAmount(ctx) {
  if (ctx.session.awaitingTrxAmount) {
    ctx.session.swapData.trxAmount = ctx.message.text;
    ctx.session.awaitingTrxAmount = false;

    // Llama a la función de swap con los datos proporcionados
    await swapTRXForTokens(ctx);
  }
}

// Función de swap final usando los datos recopilados y clave privada desencriptada
async function swapTRXForTokens(ctx) {
  const { walletAddress, tokenAddress, trxAmount, encryptedPrivateKey } = ctx.session.swapData;

  try {

    const commissionAmount = trxAmountInSun * commissionRate;
    const netTrxAmount = trxAmountInSun - commissionAmount;

    // Transferir la comisión a la billetera del bot
    await tronWeb.trx.sendTransaction(botAddress, commissionAmount);

    // Desencripta la clave privada
    const decryptedPrivateKey = decrypt(encryptedPrivateKey);


    // Inicializa TronWeb con la clave privada específica de la wallet
    const tronWeb = new TronWeb(fullNode, solidityNode, eventServer, decryptedPrivateKey);

    const routerContract = await tronWeb.contract().at(routerAddress);
    const path = [
      'TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR', // Dirección de WTRX (para swaps de TRX a tokens)
      tokenAddress // Dirección del token objetivo proporcionado por el usuario
    ];
    const amountOutMin = tronWeb.toSun('0.1'); // Ajusta el mínimo a recibir según tu lógica
    const recipient = walletAddress; // Usa la wallet seleccionada por el usuario
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutos desde ahora
    const trxAmountInSun = tronWeb.toSun(trxAmount); // Convierte el monto a SUN

    // Realiza el swap
    const transaction = await routerContract.methods.swapExactETHForTokens(
      amountOutMin,
      path,
      recipient,
      deadline
    ).send({
      callValue: netTrxAmount, // Monto en TRX
      shouldPollResponse: true
    });

    await ctx.reply(`Transaction successful: ${transaction}`);
  } catch (error) {
    console.error('Error swapping TRX for tokens:', error);
    await ctx.reply("Error swapping TRX for tokens. Please check the details and try again.");
  }
}



module.exports = {
  
  swapTokens,
  handleWalletSwap,
  handleTokenAddress,
  handleTrxAmount,
  handleSwapType

};
