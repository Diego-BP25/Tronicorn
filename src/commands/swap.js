const { fetchAllWallets, fetch_Private_key } = require("../service/user.service");
const { Markup } = require('telegraf');
const { decrypt } = require('../utils/tron');
const TronWeb = require('tronweb');
const BigNumber = require('bignumber.js');


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
      [Markup.button.callback("TRX➡️Tokens", `swap_type_TRX_TOKENS`)],
      [Markup.button.callback("Tokens➡️TRX", `swap_type_TOKENS_TRX`)]
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

  console.log("privateKeyResult:", privateKeyResult);

  if (privateKeyResult.success) { 
    console.log("Encrypted Private Key:", privateKeyResult.encryptedPrivateKey);
    // Almacena la clave privada cifrada en la sesión
    ctx.session.swapData = {
      encryptedPrivateKey: privateKeyResult.encryptedPrivateKey,
      walletAddress
    };
    
    await ctx.reply("Enter the token address you want to swap (not TRX)");
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

    // Desencripta la clave privada
    const decryptedPrivateKey = decrypt(encryptedPrivateKey);


    // Inicializa TronWeb con la clave privada específica de la wallet
    const tronWeb = new TronWeb(fullNode, solidityNode, eventServer, decryptedPrivateKey);

    const trxAmountInSun = tronWeb.toSun(trxAmount); // Convierte el monto a SUN
    const commissionAmount = trxAmountInSun * commissionRate;
    const netTrxAmount = trxAmountInSun - commissionAmount;
    // ABI for fetching token decimals & symbol
    const tokenDetailsABI = [
      { "constant": true, "inputs": [], "name": "decimals", "outputs": [{ "name": "", "type": "uint8" }], "stateMutability": "view", "type": "function" },
      { "constant": true, "inputs": [], "name": "symbol", "outputs": [{ "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }
    ];
    const tokenContract = await tronWeb.contract(tokenDetailsABI, tokenAddress);
    const decimals = await tokenContract.decimals().call();
    const symbol = await tokenContract.symbol().call();

    console.log(`✅ Token: ${symbol} (${decimals} decimals)`);
    

    // Transferir la comisión a la billetera del bot
    await tronWeb.trx.sendTransaction(botAddress, commissionAmount);

    const routerContract = await tronWeb.contract().at(routerAddress);
    const path = [
      'TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR', // Dirección de WTRX (para swaps de TRX a tokens)
      tokenAddress // Dirección del token objetivo proporcionado por el usuario
    ];
    const amountOutMin = tronWeb.toSun('0.1'); // Ajusta el mínimo a recibir según tu lógica
    const recipient = walletAddress; // Usa la wallet seleccionada por el usuario
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutos desde ahora
    let amountsOut = await routerContract.getAmountsOut(trxAmountInSun, path).call();


    let formattedTokenAmount = new BigNumber(amountsOut.amounts[1]).dividedBy(new BigNumber(10).pow(decimals));
        console.log(`📊 Converted Token Amount: ${formattedTokenAmount.toString()} ${symbol}`);

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

    // Generar el enlace de Tronscan con el hash de la transacción
    const tronScanLink = `https://tronscan.org/#/transaction/${transaction}`;

    // Esperar y obtener los logs del swap
    await fetchEventLogsWithRetries(transaction, 10, 3000, decimals, symbol);

    await ctx.reply(`✅ Swap executed!\n\n Txn Hash: ${transaction}\n\n🔗 [view in Tronscan](${tronScanLink}`);
  } catch (error) {
    console.error('Error swapping TRX for tokens:', error);
    await ctx.reply("Error swapping TRX for tokens. Please check the details and try again.");
  }
}

// Función para obtener logs de la transacción con reintentos
async function fetchEventLogsWithRetries(txID, maxRetries, delay, tokenDecimals, tokenSymbol) {
    let attempts = 0;

    while (attempts < maxRetries) {
        try {
            const eventUrl = `${fullNode}/v1/transactions/${txID}/events`;
            const eventResponse = await axios.get(eventUrl);
            const events = eventResponse.data.data;

            if (events.length > 0) {
                for (const event of events) {
                    if (event.event_name === 'Swap') {
                        formatSwapResult(event.result, tokenDecimals, tokenSymbol);
                        return;
                    }
                }
            }
        } catch (err) {
            console.error(`⚠️ Error obteniendo eventos de swap para ${tokenSymbol}:`, err);
        }

        attempts++;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    console.log(`⚠️ No se encontraron eventos de swap para ${tokenSymbol} después de varios intentos.`);
}

// Formatear y mostrar los resultados del swap
function formatSwapResult(result, tokenDecimals, tokenSymbol) {
  const amount0In = parseInt(result.amount0In);
  const amount1Out = parseInt(result.amount1Out);

  let trxAmount, tokenAmount;

  if (BigInt(result.amount0In) > 0 && BigInt(result.amount1Out) > 0) {
      trxAmount = Number(BigInt(result.amount0In)) / 1_000_000; // Sun → TRX
      tokenAmount = Number(BigInt(result.amount1Out)) / (10 ** tokenDecimals);
  } else if (BigInt(result.amount1In) > 0 && BigInt(result.amount0Out) > 0) {
      trxAmount = Number(BigInt(result.amount1In)) / 1_000_000; // Sun → TRX
      tokenAmount = Number(BigInt(result.amount0Out)) / (10 ** tokenDecimals);
  } else {
      console.log(`❌ Datos de swap inválidos para ${tokenSymbol}.`);
      return;
  }

  const entryPrice = trxAmount / tokenAmount;

  console.log(`✅ Has cambiado ${trxAmount.toFixed(6)} TRX por ${tokenAmount.toFixed(tokenDecimals)} ${tokenSymbol}`);
  console.log(`💰 Precio de entrada: ${entryPrice.toFixed(8)} TRX por ${tokenSymbol}`);
}





module.exports = {
  
  swapTokens,
  handleWalletSwap,
  handleTokenAddress,
  handleTrxAmount,
  handleSwapType

};
