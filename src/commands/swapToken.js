const { fetchAllWallets, fetch_Private_key } = require("../service/user.service");
const { Markup } = require('telegraf');
const { decrypt } = require('../utils/tron');
const BigNumber = require('bignumber.js');
const axios = require('axios'); 
const { clearAllSessionFlows } = require('./clearSessions');

const TronWeb = require('tronweb').TronWeb;
const fullHost = 'https://api.trongrid.io';

const CONTRACTS = {
  ROUTER: {
    address: 'TXF1xDbVGdxFGbovmmmXvBGu8ZiE3Lq4mR',
    abi: [
      {
        "inputs": [
          { "name": "amountIn", "type": "uint256" },
          { "name": "path", "type": "address[]" }
        ],
        "name": "getAmountsOut",
        "outputs": [{ "name": "amounts", "type": "uint256[]" }],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          { "name": "amountIn", "type": "uint256" },
          { "name": "amountOutMin", "type": "uint256" },
          { "name": "path", "type": "address[]" },
          { "name": "to", "type": "address" },
          { "name": "deadline", "type": "uint256" }
        ],
        "name": "swapExactTokensForETH",
        "outputs": [{ "name": "amounts", "type": "uint256[]" }],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ]
  },
  WTRX: {
    address: 'TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR'
  }
};

const ERC20_ABI = [
  {
    "constant": true,
    "inputs": [{ "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "", "type": "uint256" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "name": "", "type": "string" }],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      { "name": "spender", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

  // Manejador para ingresar la cantidad de TRX a invertir en el pump
  async function amountTrxSwapToken(ctx) {
    try {
      clearAllSessionFlows(ctx);
      // Crear los botones en el formato deseado
      const buttons = Markup.inlineKeyboard([
        [
          Markup.button.callback('5 Tokens', 'swapToken_amount_5'),
          Markup.button.callback('10 Tokens', 'swapToken_amount_10'),
          Markup.button.callback('20 Tokens', 'swapToken_amount_20')
        ],
        [Markup.button.callback('✏️ Personalize', 'swapToken_amount_custom')] // Botón debajo
      ]);
  
      await ctx.reply('Please enter the amount of token to swap',buttons);
    } catch (error) {
      console.error('Error in amountTrx:', error);
      await ctx.reply('Ocurrió un error al solicitar la cantidad de TRX.');
    }
  }

  // Manejador para la selección del monto
  async function handleAmountSelectionSwapToken(ctx) {
    const selectedAmount = ctx.match[0].replace('swapToken_amount_', '');
  
    if (selectedAmount === 'custom') {
      ctx.session.swapTokenState = 'waitingForCustomAmountSwap';
      await ctx.reply('Please enter the amount of Tokens to invest in the swap:');
      ctx.session.awaitingTokenAmount = true;
    } else {
      ctx.session.swapTokenAmount = parseFloat(selectedAmount); // Guardar siempre el monto seleccionado
      await showSlippageOptionsSwapToken(ctx);
    }
  }

  // Manejador para la entrada de monto personalizado
  async function handleCustomAmountSwapToken(ctx) {
    if (ctx.session.swapTokenState === 'waitingForCustomAmountSwap') {
      ctx.session.swapTokenAmount = parseFloat(ctx.message.text); // Guardar el monto ingresado
      ctx.session.awaitingTokenAmount = false; // Resetear estado
      await showSlippageOptionsSwapToken(ctx);
    }
  }

  // Función para mostrar opciones de deslizamiento
  async function showSlippageOptionsSwapToken(ctx) {
    const buttons = Markup.inlineKeyboard([
      [
        Markup.button.callback('5%', 'swapToken_slippage_5'),
        Markup.button.callback('10%', 'swapToken_slippage_10'),
        Markup.button.callback('20%', 'swapToken_slippage_20')
      ],
      [Markup.button.callback('✏️ Personalize', 'swapToken_slippage_custom')]
    ]);
  
    await ctx.reply('Select the slippage percentage:', buttons);
  }
  
  // Manejador para la selección del deslizamiento
  async function handleSlippageSelectionSwapToken(ctx) {
    const selectedSlippageSwap = ctx.match[0].replace('swapToken_slippage_', '');
  
    if (selectedSlippageSwap === 'custom') {
      ctx.session.swapTokenState = 'waitingForCustomSlippageSwapToken';
      await ctx.reply('Please enter the slippage percentage:');
      ctx.session.awaitingSlippageToken = true;
  
    } else {
      ctx.session.swapTokenSlippage = Math.min(Math.max(parseFloat(selectedSlippageSwap) || 1, 0.1), 50);;
      await handleWalletSwapToken(ctx);
    }
  }
  
  // Manejador para la entrada de deslizamiento personalizado
  async function  handleCustomSlippageSwapToken(ctx) {
    if (ctx.session.swapTokenState === 'waitingForCustomSlippageSwapToken') {
      ctx.session.swapTokenSlippage = Math.min(Math.max(parseFloat(ctx.message.text) || 1, 0.1), 50);
      ctx.session.awaitingSlippageToken = false;
      await handleWalletSwapToken(ctx);
      
    }
  }

  async function handleWalletSwapToken(ctx) {
    try {
      const userId = ctx.chat.id;
  
      // Obtener todas las wallets del usuario
      const walletResult = await fetchAllWallets(userId);
  
      if (walletResult.success && walletResult.wallets.length > 0) {
        // Listar las wallets del usuario como botones
        const walletButtons = walletResult.wallets.map(wallet => {
          return [Markup.button.callback(wallet.wallet_name, `swapToken_wallet_${wallet.wallet_address}`)];
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

  async function contractToken(ctx) {
    const callbackData = ctx.update.callback_query.data;
    const walletAddress = callbackData.replace('swapToken_wallet_', '');
  
    // Recuperar la clave privada cifrada de la wallet
    const userId = ctx.chat.id;
    const privateKeyResult = await fetch_Private_key(userId, walletAddress);
  
    if (privateKeyResult.success) { 
      // Almacena la clave privada cifrada en la sesión
      ctx.session.encryptedPrivateKey = privateKeyResult.encryptedPrivateKey;
      ctx.session.walletAddress = walletAddress;

      
      await ctx.reply("Enter the contract for the token you want to swap");
      ctx.session.awaitingTokenSwap = true; // Marca que estamos esperando la dirección del token
    } else {
      await ctx.reply("Could not fetch the private key for this wallet. Please check your wallet details.");
    }
  }

  async function swapTokenToTRX(ctx) {

     // Limpiar datos antiguos del swap anterior
     ctx.session.swapTokenFinal = null;

    if (ctx.session.awaitingTokenSwap && !ctx.session.tokenAddress) {
      ctx.session.tokenAddress = ctx.message.text;
      ctx.session.awaitingTokenSwap = false;
    }

    try {
      const { swapTokenAmount, swapTokenSlippage, walletAddress, tokenAddress, encryptedPrivateKey } = ctx.session;
      if (!swapTokenAmount || !walletAddress || !tokenAddress ||!encryptedPrivateKey) {
        await ctx.reply("❌ Missing data. Please make sure to complete all steps of the swap.");
        return;
      }
   
      // Desencriptar clave privada (asume que tienes esta función lista)
      const privateKey = decrypt(encryptedPrivateKey);
      const tronWeb = new TronWeb({ fullHost: 'https://api.trongrid.io', privateKey });
  
      const tokenContract = await tronWeb.contract(ERC20_ABI, tokenAddress);
      const [decimals, symbol] = await Promise.all([
        tokenContract.methods.decimals().call().then(d => parseInt(d)),
        tokenContract.methods.symbol().call()
      ]);
  
      const amountInWei = new BigNumber(swapTokenAmount).times(10 ** decimals).toFixed(0);
      const router = await tronWeb.contract(CONTRACTS.ROUTER.abi, CONTRACTS.ROUTER.address);
      const path = [
        tokenAddress,
        CONTRACTS.WTRX.address
      ];
        
      const amountsOut = await router.methods.getAmountsOut(amountInWei, path).call();
      const outputRaw = new BigNumber(Array.isArray(amountsOut[0]) ? amountsOut[0][1] : amountsOut[1]);
      const estimatedTRX = outputRaw.dividedBy(1e6).toFixed(6);
  
      const minTRXRaw = outputRaw
        .multipliedBy(new BigNumber(100).minus(swapTokenSlippage))
        .dividedBy(100)
        .integerValue(BigNumber.ROUND_FLOOR)
        .toFixed(0);

        
        const message = `🔎 *Swap Preview*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `• *Amount:* ${swapTokenAmount} ${symbol}\n` +
    `• *Slippage:* ${swapTokenSlippage}%\n` +
    `• *Estimated TRX:* ${estimatedTRX}\n` +
    `• *Minimum Received:* ${new BigNumber(minTRXRaw).dividedBy(1e6).toFixed(6)} TRX\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `\n*Do you want to proceed?*`;
      
    await ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          Markup.button.callback("✅ Confirm", "confirm_swapToken"),
          Markup.button.callback("❌ Cancel", "cancel_swapToken")
        ])
      });
  
      // Guardamos temporalmente los datos calculados en sesión para usarlos si confirman
      ctx.session.swapTokenFinal = {
        privateKey,
        tokenAddress,
        amountInWei,
        minTRXRaw,
        path
};
  
    } catch (error) {
      console.error("❌ Error in swapTokenToTRXBot:", error.message);
      await ctx.reply(`Error performing swap: ${error.message}`);
    }
  }
  
  async function handleConfirmSwapToken(ctx) {

    try {
      const swapTokenFinal = ctx.session.swapTokenFinal;
      const { privateKey,amountInWei,minTRXRaw, tokenAddress, path } = swapTokenFinal;
      const tronWeb = new TronWeb({ fullHost: 'https://api.trongrid.io', privateKey });
      const tokenContract = await tronWeb.contract(ERC20_ABI, tokenAddress);
      const router = await tronWeb.contract(CONTRACTS.ROUTER.abi, CONTRACTS.ROUTER.address);
      const txOwner = tronWeb.defaultAddress.base58;
      function escapeMarkdownV2(text) {
        return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
      }  
      await ctx.reply("⚡ Approving token spend...");
      const approveTx = await tokenContract.methods.approve(
        CONTRACTS.ROUTER.address,
        amountInWei)
        .send({ feeLimit: 100_000_000 });
      await ctx.reply(`✅ Approval TX sent: ${approveTx.txID || approveTx}`);
  
      await ctx.reply("⚡ Executing swap...");
      const deadline = Math.floor(Date.now() / 1000) + 1200;
  
      const tx = await router.methods.swapExactTokensForETH(
        swapTokenFinal.amountInWei,
        swapTokenFinal.minTRXRaw,
        path,
        txOwner,
        deadline
      ).send({ feeLimit: 200_000_000 });
  
      const txHash = tx; // tx contiene el hash directamente
  
      function escapeMarkdownV2(text) {
        return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
      }
      const tronScanTxLink = `https://tronscan.org/#/transaction/${txHash}`;

      const escapedMessage = escapeMarkdownV2(
        `✅ Swap Successful!\n\nTxn Hash: ${txHash}\n\n`
      );
      
      const linkMarkdown = `[🔗 View on Tronscan](${tronScanTxLink})`; // ¡sin escapar!
      
      await ctx.reply(
        escapedMessage + linkMarkdown,
        { parse_mode: "MarkdownV2", disable_web_page_preview: true }
      );

    } catch (error) {
      console.error("❌ Error en handleConfirmSwapToken:", error);
      await ctx.reply(`❌ Error executing swap: ${error.message}`);
    }
  };


  async function SwapTokenNo(ctx){

    await ctx.editMessageReplyMarkup(); // Borra los botones
    await ctx.reply("❌ Swap cancelled by user.");
    ctx.session.swapDetails = null;
  }

  module.exports = {
    SwapTokenNo,
    handleConfirmSwapToken,
    contractToken,
    swapTokenToTRX,
    handleCustomSlippageSwapToken,
    handleSlippageSelectionSwapToken,
    handleCustomAmountSwapToken,
    handleAmountSelectionSwapToken,
    amountTrxSwapToken
  };