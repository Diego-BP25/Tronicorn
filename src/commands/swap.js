const { fetchAllWallets, fetch_Private_key } = require("../service/user.service");
const { Markup, Telegraf  } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN)
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
    ctx.session.swapSlippage = Math.min(Math.max(parseFloat(selectedSlippageSwap) || 1, 0.1), 50);;
    await swapTokens(ctx);
  }
}

// Manejador para la entrada de deslizamiento personalizado
async function  handleCustomSlippageSwap(ctx) {
  if (ctx.session.swapState === 'waitingForCustomSlippageSwap') {
    ctx.session.swapSlippage = Math.min(Math.max(parseFloat(ctx.message.text) || 1, 0.1), 50);
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

async function confirmSwap(ctx, details) {
  const message = `🔎 *Swap Preview*\n` +
    `----------------------------\n` +
    `• *TRX Amount:* ${details.trxAmount}\n` +
    `• *Token:* ${details.tokenSymbol} (${details.tokenDecimals} decimals)\n` +
    `• *Slippage:* ${details.slippage}%\n` +
    `• *Estimated Tokens:* ${details.estimatedTokens}\n` +
    `• *Min After Slippage:* ${details.minTokens}\n` +
    `----------------------------\n` +
    `\n*Confirm swap?*`;

  // Guardamos los detalles en la sesión
  ctx.session.swapDetails = details;

  await ctx.reply(message, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      Markup.button.callback("✅ Yes", "confirm_swap_yes"),
      Markup.button.callback("❌ No", "confirm_swap_no")
    ])
  });
}


// Execute swap
async function executeSwap(ctx) {
  const { tokenAddress,encryptedPrivateKey} = ctx.session.swapData;
  const { swapAmount, swapSlippage } = ctx.session;


      // Desencripta la clave privada
      const decryptedPrivateKey = decrypt(encryptedPrivateKey);

  const tronWeb = new TronWeb(FULL_NODE, SOLIDITY_NODE, EVENT_SERVER, decryptedPrivateKey);


  if (ctx.session.awaitingTokenAddress && !ctx.session.swapData.tokenAddress) {
    ctx.session.swapData.tokenAddress = ctx.message.text;
    ctx.session.awaitingTokenAddress = false;
  }
  const { decimals, symbol } = await getTokenDetails(ctx);


  if (symbol === "UNKNOWN") {
      console.log(`⚠️ Warning: Could not fetch token details for ${tokenAddress}. Swap cancelled.`);
      return;
  }
  console.log("🧪 swapData:", ctx.session);
  console.log("🔢 swapAmount:", swapAmount);
  console.log("🔢 swapSlippage:", swapSlippage);



  const trxAmountBN = new BigNumber(swapAmount);
    const trxAmountInSun = trxAmountBN.times(1_000_000).toFixed(0);
    const routerContract = await tronWeb.contract().at(ROUTER_ADDRESS);
    const path = [WTRX, tokenAddress];

    const amountsOut = await routerContract.getAmountsOut(trxAmountInSun, path).call();
    
    if (!amountsOut?.amounts || amountsOut.amounts.length < 2) {
        throw new Error("Invalid router response");
    }

  const tokenAmountRaw = new BigNumber(amountsOut.amounts[1]);
  const estimatedTokens = tokenAmountRaw.dividedBy(10 ** decimals).toFixed(decimals);
  const minTokens = tokenAmountRaw
      .times(1 - swapSlippage / 100)
      .dividedBy(10 ** decimals)
      .toFixed(decimals);

      await confirmSwap(ctx, {
        trxAmount: trxAmountBN.toFixed(6),
        tokenSymbol: symbol,
        tokenDecimals: decimals,
        slippage: swapSlippage,
        estimatedTokens,
        minTokens
      });
}

bot.action("confirm_swap_yes", async (ctx) => {
  const { swapDetails } = ctx.session;

  if (!swapDetails) {
    return ctx.reply("❌ No swap data found in session.");
  }

  await ctx.editMessageReplyMarkup(); // Borra los botones

  if (swapDetails.tokenDecimals === 18) {
    await swapTRXForTokens18(ctx, swapDetails.tokenDecimals, swapDetails.tokenSymbol);
  } else {
    await swapTRXForTokens6(ctx, swapDetails.tokenDecimals, swapDetails.tokenSymbol);
  }

  ctx.session.swapDetails = null; // limpiar sesión
});

bot.action("confirm_swap_no", async (ctx) => {
  await ctx.editMessageReplyMarkup(); // Borra los botones
  await ctx.reply("❌ Swap cancelled by user.");
  ctx.session.swapDetails = null;
});


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

      //let formattedTokenAmount = new BigNumber(amountsOut.amounts[1]).dividedBy(new BigNumber(10).pow(tokenDecimals));
      //console.log(`📊 Converted Token Amount: ${formattedTokenAmount.toString()} ${tokenSymbol}`);

      const minAmountOut = new BigNumber(amountsOut.amounts[1]).multipliedBy(1 - swapSlippage / 100);
      //console.log(`📉 Minimum Amount Out (after slippage): ${minAmountOut.dividedBy(new BigNumber(10).pow(tokenDecimals)).toString()}`);

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

      const tronScanTxLink = `https://tronscan.org/#/transaction/${transaction}`;

      function escapeMarkdownV2(text) {
        return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
      }

      ctx.reply (escapeMarkdownV2(
        `✅ Swap executed!\n\nTxn Hash: ${transaction}\n` +
        `[🌍 View on Tronscan](${tronScanTxLink})`
      ),
        { parse_mode: "MarkdownV2", disable_web_page_preview: true }
      );
// Validar chatId antes de continuar
if (!ctx.chat?.id) {
  console.error('Error: chatId no está definidoo');
  return;
}
       setImmediate(async () => {
      try {
        await fetchEventLogsWithRetries({
          transaction,
          tokenDecimals,
          tokenSymbol,
          ctx
      });
      } catch (error) {
        console.error("Error en procesamiento secundario:", error);
        
      }
    });

  } catch (error) {
      ctx.reply(`❌ Swap failed: ${error.message}`);
  }

}

// Fetch event logs with retries
async function fetchEventLogsWithRetries({transaction,  maxRetries = 10, delay = 3000, tokenDecimals, tokenSymbol, ctx}) {
  let attempts = 0;

  while (attempts < maxRetries) {
      try {
          const eventUrl = `${FULL_NODE}/v1/transactions/${transaction}/events`;
          const eventResponse = await axios.get(eventUrl);
          const events = eventResponse.data.data;

          if (events.length > 0) {
              for (const event of events) {
                  if (event.event_name === 'Swap') {

                    await formatSwapResult(event.result, tokenDecimals, tokenSymbol, ctx);
                      return;
                  }
              }
          }
      } catch (err) {
        console.error(`⚠️ Error retrieving swap events for ${tokenSymbol}:`, err);
        }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, delay));
  }

  ctx.reply(`⚠️ No swap events found for ${tokenSymbol} after multiple attempts.`);
}

// Formatear y mostrar los resultados del swap
async function formatSwapResult(result, tokenDecimals, tokenSymbol, ctx) {
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
    await ctx.reply(
      `❌ Invalid swap data for ${tokenSymbol}.`
    )
      return;
  }

  const entryPrice = trxAmount / tokenAmount;

  // Enviar mensajes con verificación EXTRA
  const messages = [
    `✅ Swapped ${trxAmount.toFixed(6)} TRX for ${tokenAmount.toFixed(tokenDecimals)} ${tokenSymbol}\n💰 Price: ${entryPrice.toFixed(8)} TRX/${tokenSymbol}`
  ];

  await ctx.reply (messages)
}

// Swap function for 6-decimal tokens
async function swapTRXForTokens6(ctx, tokenDecimals, tokenSymbol) {

  
  const { swapAmount, swapSlippage, swapData } = ctx.session;
  const { tokenAddress, encryptedPrivateKey } = swapData;

      // Desencripta la clave privada
      const decryptedPrivateKey = decrypt(encryptedPrivateKey);

  const tronWeb = new TronWeb(FULL_NODE, SOLIDITY_NODE, EVENT_SERVER, decryptedPrivateKey);
  try {
      const trxAmountInSun = tronWeb.toSun(swapAmount);
      const routerContract = await tronWeb.contract().at(ROUTER_ADDRESS);
      const path = [WTRX, tokenAddress];

      await ctx.reply(`🚀 Swapping ${swapAmount.toFixed(6)} TRX for ${tokenSymbol} with ${swapSlippage}% slippage tolerance...`);

      let amountsOut = await routerContract.getAmountsOut(trxAmountInSun, path).call();
      if (!amountsOut || !amountsOut.amounts || amountsOut.amounts.length < 2) {
          throw new Error("Invalid output from router: amountsOut is malformed.");
      }

      // let formattedTokenAmount = new BigNumber(amountsOut.amounts[1]).dividedBy(new BigNumber(10).pow(6));
      // console.log(`📊 Converted Token Amount: ${formattedTokenAmount.toString()} ${tokenSymbol}`);

      // ✅ FIX: Ensure minAmountOut is an integer (no decimals)
      const minAmountOut = new BigNumber(amountsOut.amounts[1])
          .multipliedBy(1 - swapSlippage / 100)
          .integerValue(BigNumber.ROUND_FLOOR);  // ✅ No decimals, prevents BigInt error

      //console.log(`📉 Minimum Amount Out (after slippage): ${minAmountOut.toFixed(0)}`);

      if (swapSlippage === 0 && minAmountOut.isLessThan(amountsOut.amounts[1])) {
        await ctx.reply("🛑 Swap failed due to strict 0% slippage: Market price changed slightly.");
          return;
      }

      const transaction = await routerContract.swapExactETHForTokens(
          minAmountOut.toFixed(0),  // ✅ Ensures integer format
          path,
          tronWeb.defaultAddress.base58,
          DEADLINE
      ).send({ callValue: trxAmountInSun });

      const tronScanTxLink = `https://tronscan.org/#/transaction/${transaction}`;

      function escapeMarkdownV2(text) {
        return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
      }

      await ctx.reply(escapeMarkdownV2(
        `✅ Swap executed!\n\nTxn Hash: ${transaction}\n` +
        `[🌍 View on Tronscan](${tronScanTxLink})`
      ),
        { parse_mode: "MarkdownV2", disable_web_page_preview: true });

      setImmediate(async () => {
        try {
          await listenForSwapEvents({
            transaction,
            swapAmount,
            tokenDecimals,
            tokenSymbol,
            ctx
        });
        } catch (error) {
          console.error("Error en procesamiento secundario:", error);
          
        }
      });

  } catch (error) {
      console.error(`❌ Swap failed for ${tokenSymbol}:`, error.message || error);
  }
}

// Fetch swap logs for 6-decimal tokens
async function listenForSwapEvents({transaction, swapAmount, tokenDecimals, tokenSymbol, ctx}) {
  const eventUrl = `https://api.trongrid.io/v1/transactions/${transaction}/events`;

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
                      const entryPrice = swapAmount / tokenReceived;

                      // Enviar mensajes con verificación EXTRA
                      const messages = [
                        `✅ You swapped ${swapAmount.toFixed(6)} TRX for ${tokenReceived.toFixed(tokenDecimals)} ${tokenSymbol}\n💰 Entry price: ${entryPrice.toFixed(6)} TRX per ${tokenSymbol}`
                      ];

                      ctx.reply(messages);
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