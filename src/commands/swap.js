const { fetchAllWallets, fetch_Private_key } = require("../service/user.service");
const { Markup } = require('telegraf');
const { decrypt } = require('../utils/tron');
const TronWeb = require('tronweb').TronWeb;
const BigNumber = require('bignumber.js');
const axios = require('axios');


const FULL_NODE = 'https://api.trongrid.io';
const SOLIDITY_NODE = 'https://api.trongrid.io';
const EVENT_SERVER = 'https://api.trongrid.io';
const ROUTER_ADDRESS = 'TXF1xDbVGdxFGbovmmmXvBGu8ZiE3Lq4mR'; // SunSwap V2 Router
const WTRX = 'TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR'; // Wrapped TRX
const DEADLINE = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

// Definir el porcentaje de comisión
const commissionRate = 0.01; // Comisión del 1%
const botAddress = 'TPB27eRk4gPcYqSh4ihqXmdWZWidB87quR'; // Dirección para recibir la comisión


 // ABI for fetching token decimals & symbol
 const tokenDetailsABI = [
  { "constant": true, "inputs": [], "name": "decimals", "outputs": [{ "name": "", "type": "uint8" }], "stateMutability": "view", "type": "function" },
  { "constant": true, "inputs": [], "name": "symbol", "outputs": [{ "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }
];

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


  // Manejador para ingresar la cantidad de TRX a invertir en el pump
async function amountTrxSwap(ctx) {
  try {

    // Crear los botones en el formato deseado
    const buttons = Markup.inlineKeyboard([
      [
        Markup.button.callback('5 TRX', 'swap_amount_5'),
        Markup.button.callback('10 TRX', 'swap_amount_10'),
        Markup.button.callback('20 TRX', 'swap_amount_20')
      ],
      [Markup.button.callback('✏️ Personalize', 'swap_amount_custom')] // Botón debajo
    ]);

    await ctx.reply('Please enter the amount of TRX to swap',buttons);
  } catch (error) {
    console.error('Error in amountTrx:', error);
    await ctx.reply('Ocurrió un error al solicitar la cantidad de TRX.');
  }
}


// Manejador para la selección del monto
async function handleAmountSelectionSwap(ctx) {
  const selectedAmount = ctx.match[0].replace('swap_amount_', '');

  if (selectedAmount === 'custom') {
    ctx.session.swapState = 'waitingForCustomAmountSwap';
    await ctx.reply('Please enter the amount of TRX to invest in the swap:');
    ctx.session.awaitingTrxAmount = true;
  } else {
    ctx.session.swapAmount = parseFloat(selectedAmount); // Guardar siempre el monto seleccionado
    await showSlippageOptionsSwap(ctx);
  }
}


// Manejador para la entrada de monto personalizado
async function handleCustomAmountSwap(ctx) {
  if (ctx.session.swapState === 'waitingForCustomAmountSwap') {
    ctx.session.swapAmount = parseFloat(ctx.message.text); // Guardar el monto ingresado
    ctx.session.awaitingTrxAmount = false; // Resetear estado
    await showSlippageOptionsSwap(ctx);
  }
}

// Función para mostrar opciones de deslizamiento
async function showSlippageOptionsSwap(ctx) {
  const buttons = Markup.inlineKeyboard([
    [
      Markup.button.callback('5%', 'swap_slippage_5'),
      Markup.button.callback('10%', 'swap_slippage_10'),
      Markup.button.callback('20%', 'swap_slippage_20')
    ],
    [Markup.button.callback('✏️ Personalize', 'swap_slippage_custom')]
  ]);

  await ctx.reply('Select the sliding percentage:', buttons);
}

// Manejador para la selección del deslizamiento
async function handleSlippageSelectionSwap(ctx) {
  const selectedSlippageSwap = ctx.match[0].replace('swap_slippage_', '');

  if (selectedSlippageSwap === 'custom') {
    ctx.session.swapState = 'waitingForCustomSlippageSwap';
    await ctx.reply('Please enter the slip percentage:');
    ctx.session.awaitingSlippage = true;

  } else {
    ctx.session.swapSlippage = parseFloat(selectedSlippageSwap);
    await swapTokens(ctx);
  }
}

// Manejador para la entrada de deslizamiento personalizado
async function  handleCustomSlippageSwap(ctx) {
  if (ctx.session.swapState === 'waitingForCustomSlippageSwap') {
    ctx.session.swapSlippage = parseFloat(ctx.message.text);
    ctx.session.awaitingSlippage = false;
    await swapTokens(ctx);
    
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
    
    await ctx.reply("Enter the token address you want to swap (not TRX)");
    ctx.session.awaitingTokenAddress = true; // Marca que estamos esperando la dirección del token
  } else {
    await ctx.reply("Could not fetch the private key for this wallet. Please check your wallet details.");
  }
}

// Function to fetch token decimals and symbol
async function getTokenDetails(ctx) {
  const { tokenAddress, encryptedPrivateKey } = ctx.session.swapData;
      // Desencripta la clave privada
      const decryptedPrivateKey = decrypt(encryptedPrivateKey);

  const tronWeb = new TronWeb(FULL_NODE, SOLIDITY_NODE, EVENT_SERVER, decryptedPrivateKey);
  try {
      await ctx.reply(`🔍 Fetching details for token: ${tokenAddress}...`);
      const tokenContract = await tronWeb.contract(tokenDetailsABI, tokenAddress);
      const [decimals, symbol] = await Promise.all([
          tokenContract.decimals().call(),
          tokenContract.symbol().call()
      ]);
      await ctx.reply(`✅ Token: ${symbol}`);
      return { decimals: parseInt(decimals), symbol };
  } catch (error) {
      console.error("⚠️ Error fetching token details, defaulting to 6 decimals & UNKNOWN symbol:", error);
      return { decimals: 6, symbol: "UNKNOWN" };
  }
}

// Execute swap
async function executeSwap(ctx) {
  const { swapAmount,tokenAddress, swapSlippage} = ctx.session.swapData;

  if (ctx.session.awaitingTokenAddress && !ctx.session.swapData.tokenAddress) {
    ctx.session.swapData.tokenAddress = ctx.message.text;
    ctx.session.awaitingTokenAddress = false;
  }
  const { decimals, symbol } = await getTokenDetails(ctx);


  if (symbol === "UNKNOWN") {
      console.log(`⚠️ Warning: Could not fetch token details for ${tokenAddress}. Swap cancelled.`);
      return;
  }

  if (decimals === 18) {
      await swapTRXForTokens18(ctx, decimals, symbol);
  } else {
      await swapTRXForTokens6(swapAmount, tokenAddress, symbol, swapSlippage);
  }
}

// Swap function for 18-decimal tokens
async function swapTRXForTokens18(ctx, tokenDecimals, tokenSymbol) {

  const { swapAmount, swapSlippage, swapData } = ctx.session;
  const { tokenAddress, encryptedPrivateKey } = swapData;
  
      // Desencripta la clave privada
      const decryptedPrivateKey = decrypt(encryptedPrivateKey);

  const tronWeb = new TronWeb(FULL_NODE, SOLIDITY_NODE, EVENT_SERVER, decryptedPrivateKey);
  try {
      const trxAmountInSun = tronWeb.toSun(swapAmount);
      const routerContract = await tronWeb.contract().at(ROUTER_ADDRESS);
      const path = [WTRX, tokenAddress];

      await ctx.reply(`🚀 Attempting to swap ${swapAmount.toFixed(6)} TRX for ${tokenSymbol} with ${swapSlippage}% slippage tolerance...`);

      let amountsOut = await routerContract.getAmountsOut(trxAmountInSun, path).call();

      if (!amountsOut.amounts || amountsOut.amounts.length < 2) {
          throw new Error("Invalid output from router: amountsOut is malformed.");
      }

      let formattedTokenAmount = new BigNumber(amountsOut.amounts[1]).dividedBy(new BigNumber(10).pow(tokenDecimals));
      console.log(`📊 Converted Token Amount: ${formattedTokenAmount.toString()} ${tokenSymbol}`);

      const minAmountOut = new BigNumber(amountsOut.amounts[1]).multipliedBy(1 - swapSlippage / 100);
      console.log(`📉 Minimum Amount Out (after slippage): ${minAmountOut.dividedBy(new BigNumber(10).pow(tokenDecimals)).toString()}`);

      if (swapSlippage === 0 && minAmountOut.isLessThan(amountsOut.amounts[1])) {
          ctx.reply("🛑 Swap failed due to strict 0% slippage: Market price changed slightly.");
          return;
      }

      const transaction = await routerContract.swapExactETHForTokens(
          minAmountOut.toFixed(0),
          path,
          tronWeb.defaultAddress.base58,
          DEADLINE
      ).send({ callValue: trxAmountInSun });

      ctx.reply(`✅ Swap executed!\n\n Txn Hash: ${transaction}`);
      await fetchEventLogsWithRetries(transaction, 10, 3000, tokenDecimals, tokenSymbol,ctx);

  } catch (error) {
      ctx.reply(`❌ Swap failed: ${error.message}`);
  }
}

// Fetch event logs with retries
async function fetchEventLogsWithRetries(txID, maxRetries, delay, tokenDecimals, tokenSymbol,ctx) {
  let attempts = 0;

  while (attempts < maxRetries) {
      try {
          const eventUrl = `${FULL_NODE}/v1/transactions/${txID}/events`;
          const eventResponse = await axios.get(eventUrl);
          const events = eventResponse.data.data;

          if (events.length > 0) {
              for (const event of events) {
                  if (event.event_name === 'Swap') {

                    await formatSwapResult(event.result, tokenDecimals, tokenSymbol,ctx);
                      return;
                  }
              }
          }
      } catch (err) {
        console.error(`⚠️ Error retrieving swap events for ${tokenSymbol}:`, err);
        await ctx.reply(`⚠️ Ocurrió un error al obtener el swap de ${tokenSymbol}.`);      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, delay));
  }

  ctx.reply(`⚠️ No swap events found for ${tokenSymbol} after multiple attempts.`);
}

// Format swap results
async function formatSwapResult(result, tokenDecimals, tokenSymbol,ctx) {
  const amount0In = parseInt(result.amount0In);
  const amount1Out = parseInt(result.amount1Out);

  let trxAmount, tokenAmount;

  if (BigInt(result.amount0In) > 0 && BigInt(result.amount1Out) > 0) {
      // Caso: TRX en amount0In → Token en amount1Out
      trxAmount = Number(BigInt(result.amount0In)) / 1_000_000; // Sun → TRX
      tokenAmount = Number(BigInt(result.amount1Out)) / (10 ** tokenDecimals);
  } else if (BigInt(result.amount1In) > 0 && BigInt(result.amount0Out) > 0) {
      // Caso: TRX en amount1In → Token en amount0Out
      trxAmount = Number(BigInt(result.amount1In)) / 1_000_000; // Sun → TRX
      tokenAmount = Number(BigInt(result.amount0Out)) / (10 ** tokenDecimals);
  } else {
      ctx.reply(`❌ Invalid swap data for ${tokenSymbol}.`);
      return;
  }

  const entryPrice = trxAmount / tokenAmount;
  const message = `✅ You swapped ${trxAmount.toFixed(6)} TRX for ${tokenAmount.toFixed(tokenDecimals)} ${tokenSymbol}\n💰 Entry price: ${entryPrice.toFixed(8)} TRX per ${tokenSymbol}`;
  await ctx.reply(message);
}

// Swap function for 6-decimal tokens
async function swapTRXForTokens6(trxAmount, tokenAddress, tokenSymbol, slippageTolerance) {
  try {
      const trxAmountInSun = tronWeb.toSun(trxAmount);
      const routerContract = await tronWeb.contract().at(ROUTER_ADDRESS);
      const path = [WTRX, tokenAddress];

      console.log(`🚀 Swapping ${trxAmount.toFixed(6)} TRX for ${tokenSymbol} with ${slippageTolerance}% slippage tolerance...`);

      let amountsOut = await routerContract.getAmountsOut(trxAmountInSun, path).call();
      if (!amountsOut || !amountsOut.amounts || amountsOut.amounts.length < 2) {
          throw new Error("Invalid output from router: amountsOut is malformed.");
      }

      console.log(`📊 Raw Amounts Out:`, amountsOut);

      let formattedTokenAmount = new BigNumber(amountsOut.amounts[1]).dividedBy(new BigNumber(10).pow(6));
      console.log(`📊 Converted Token Amount: ${formattedTokenAmount.toString()} ${tokenSymbol}`);

      // ✅ FIX: Ensure minAmountOut is an integer (no decimals)
      const minAmountOut = new BigNumber(amountsOut.amounts[1])
          .multipliedBy(1 - slippageTolerance / 100)
          .integerValue(BigNumber.ROUND_FLOOR);  // ✅ No decimals, prevents BigInt error

      console.log(`📉 Minimum Amount Out (after slippage): ${minAmountOut.toFixed(0)}`);

      if (slippageTolerance === 0 && minAmountOut.isLessThan(amountsOut.amounts[1])) {
          console.log("🛑 Swap failed due to strict 0% slippage: Market price changed slightly.");
          return;
      }

      const transaction = await routerContract.swapExactETHForTokens(
          minAmountOut.toFixed(0),  // ✅ Ensures integer format
          path,
          tronWeb.defaultAddress.base58,
          DEADLINE
      ).send({ callValue: trxAmountInSun });

      console.log(`✅ Swap executed! Transaction Hash: ${transaction}`);

      // ✅ Correct event tracking for 6-decimal tokens
      await listenForSwapEvents(transaction, tokenAddress, trxAmount, 6, tokenSymbol);

  } catch (error) {
      console.error(`❌ Swap failed for ${tokenSymbol}:`, error.message || error);
  }
}

// Fetch swap logs for 6-decimal tokens
async function listenForSwapEvents(txID, tokenAddress, trxAmount, tokenDecimals, tokenSymbol) {
  const eventUrl = `https://api.trongrid.io/v1/transactions/${txID}/events`;

  for (let i = 0; i < 10; i++) {
      try {
          const response = await axios.get(eventUrl);
          const events = response.data.data;

          if (events.length > 0) {
              for (const event of events) {
                  if (
                      event.event_name === 'Transfer' &&
                      event.result &&
                      (event.result.value || event.result._amount) // ✅ Detects both log formats
                  ) {
                      const tokenReceived = parseInt(event.result.value || event.result._amount) / Math.pow(10, tokenDecimals);
                      const entryPrice = trxAmount / tokenReceived;

                      ctx.reply(`✅ You swapped ${trxAmount.toFixed(6)} TRX for ${tokenReceived.toFixed(tokenDecimals)} ${tokenSymbol}`);
                      ctx.reply(`💰 Entry price: ${entryPrice.toFixed(6)} TRX per ${tokenSymbol}`);
                      return;
                  }
              }
          }
      } catch (err) {
          console.error(`⚠️ Error retrieving swap events for ${tokenSymbol}:`, err);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));
  }

  ctx.reply(`⚠️ No swap events found for ${tokenSymbol} after multiple attempts.`);
}


// Función de swap final usando los datos recopilados y clave privada desencriptada
async function swapTRXForTokens(ctx) {
  const { walletAddress, tokenAddress, trxAmount, encryptedPrivateKey } = ctx.session.swapData;

  try {

    // Desencripta la clave privada
    const decryptedPrivateKey = decrypt(encryptedPrivateKey);
    
        // Inicializa TronWeb con la clave privada específica de la wallet
        const tronWeb = new TronWeb(FULL_NODE, SOLIDITY_NODE, EVENT_SERVER, decryptedPrivateKey);


    const trxAmountInSun = tronWeb.toSun(trxAmount); // Convierte el monto a SUN
    const commissionAmount = trxAmountInSun * commissionRate;
    const netTrxAmount = trxAmountInSun - commissionAmount;
  
    const tokenContract = await tronWeb.contract(tokenDetailsABI, tokenAddress);
    const decimals = await tokenContract.decimals().call();
    const symbol = await tokenContract.symbol().call();

    await ctx.reply (`✅ Token: ${symbol} (${decimals} decimals)`);
    

    // Transferir la comisión a la billetera del bot
    await tronWeb.trx.sendTransaction(botAddress, commissionAmount);

    const routerContract = await tronWeb.contract().at(ROUTER_ADDRESS);
    const path = [
      'TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR', // Dirección de WTRX (para swaps de TRX a tokens)
      tokenAddress // Dirección del token objetivo proporcionado por el usuario
    ];
    const amountOutMin = tronWeb.toSun('0.1'); // Ajusta el mínimo a recibir según tu lógica
    const recipient = walletAddress; // Usa la wallet seleccionada por el usuario
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutos desde ahora
    let amountsOut = await routerContract.getAmountsOut(trxAmountInSun, path).call();


    let formattedTokenAmount = new BigNumber(amountsOut.amounts[1]).dividedBy(new BigNumber(10).pow(decimals));
    console.log(`${amountsOut}`)
    await ctx.reply(`📊 Converted Token Amount: ${formattedTokenAmount.toString()} ${symbol}`);

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
    const tronScanLink = `https://tronscan.org/#/transaction/${transaction.txid}`;

    // Esperar y obtener los logs del swap
    await fetchEventLogsWithRetries(transaction, 10, 5000, decimals, symbol);

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
            const eventUrl = `${FULL_NODE}/v1/transactions/${txID}/events`;
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
  showSlippageOptionsSwap,
  executeSwap,
  handleCustomSlippageSwap,
  handleSlippageSelectionSwap,
  handleCustomAmountSwap,
  handleAmountSelectionSwap,
  amountTrxSwap,
  swapTokens,
  handleWalletSwap,
  handleSwapType

};
