const { fetchAllWallets, fetch_Private_key } = require("../service/user.service");
const { Markup } = require('telegraf');
const { decrypt } = require('../utils/tron');
const BigNumber = require('bignumber.js');
const axios = require('axios'); 
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

async function proximamente (ctx){
  await ctx.reply('🚧 This feature is in development. Available next week!');
}

  // Manejador para ingresar la cantidad de TRX a invertir en el pump
  async function amountTrxSwapToken(ctx) {
    try {
  
      // Crear los botones en el formato deseado
      const buttons = Markup.inlineKeyboard([
        [
          Markup.button.callback('5 TRX', 'swapToken_amount_5'),
          Markup.button.callback('10 TRX', 'swapToken_amount_10'),
          Markup.button.callback('20 TRX', 'swapToken_amount_20')
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
      ctx.session.swapState = 'waitingForCustomAmountSwap';
      await ctx.reply('Please enter the amount of TRX to invest in the swap:');
      ctx.session.awaitingTokenAmount = true;
    } else {
      ctx.session.swapTokenAmount = parseFloat(selectedAmount); // Guardar siempre el monto seleccionado
      await showSlippageOptionsSwapToken(ctx);
    }
  }

  // Manejador para la entrada de monto personalizado
  async function handleCustomAmountSwapToken(ctx) {
    if (ctx.session.swapState === 'waitingForCustomAmountSwap') {
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
      ctx.session.swapState = 'waitingForCustomSlippageSwapToken';
      await ctx.reply('Please enter the slip percentage:');
      ctx.session.awaitingSlippageToken = true;
  
    } else {
      ctx.session.swapTokenSlippage = Math.min(Math.max(parseFloat(selectedSlippageSwap) || 1, 0.1), 50);;
      await handleWalletSwapToken(ctx);
    }
  }
  
  // Manejador para la entrada de deslizamiento personalizado
  async function  handleCustomSlippageSwapToken(ctx) {
    if (ctx.session.swapState === 'waitingForCustomSlippageSwapToken') {
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
      const path = [tokenAddress, CONTRACTS.WTRX.address];
  
      const amountsOut = await router.methods.getAmountsOut(amountInWei, path).call();
      const outputRaw = new BigNumber(Array.isArray(amountsOut[0]) ? amountsOut[0][1] : amountsOut[1]);
      const estimatedTRX = outputRaw.dividedBy(1e6).toFixed(6);
  
      const minTRXRaw = outputRaw
        .multipliedBy(new BigNumber(100).minus(swapTokenSlippage))
        .dividedBy(100)
        .integerValue(BigNumber.ROUND_FLOOR)
        .toFixed(0);

        function escapeMarkdownV2(text) {
          return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
        }
        
      await ctx.replyWithMarkdownV2(
        escapeMarkdownV2(
          `🔄 *Swap Preview*\n` +
          `• Amount: ${swapTokenAmount} ${symbol}\n` +
          `• Slippage: ${swapTokenSlippage}%\n` +
          `• Estimated TRX: ${estimatedTRX}\n` +
          `• Minimum Received: ${new BigNumber(minTRXRaw).dividedBy(1e6).toFixed(6)} TRX\n\n` +
          `Do you want to proceed?`
        ),
        Markup.inlineKeyboard([
          [Markup.button.callback('✅ Confirm', 'confirm_swapToken')],
          [Markup.button.callback('❌ Cancel', 'cancel_swapToken')]
        ])
      );
  
      // Guardamos temporalmente los datos calculados en sesión para usarlos si confirman
      ctx.session.swapTokenFinal = {
        amountInWei,
        minTRXRaw,
        path,
        symbol,
        decimals,
        estimatedTRX
      };
  
    } catch (error) {
      console.error("❌ Error in swapTokenToTRXBot:", error.message);
      await ctx.reply(`Error performing swap: ${error.message}`);
    }
  }const handleConfirmSwapToken = async (ctx) => {
    try {
      if (!swapTokenFinal) {
        return ctx.reply("⚠️ No swap data to confirm.");
      }
  
      const { tronWeb } = ctx.session;
      const { CONTRACTS, swapTokenAmount, swapTokenSlippage, estimatedTRX, minTRXRaw, path, decimals, symbol } = swapTokenFinal;
      const tokenContract = await tronWeb.contract().at(path[0]);
      const router = await tronWeb.contract().at(CONTRACTS.ROUTER.address);
      const txOwner = tronWeb.defaultAddress.base58;
  
      const amountFormatted = new BigNumber(swapTokenAmount).toFormat(6);
      const minFormatted = new BigNumber(minTRXRaw).dividedBy(1e6).toFormat(6);
  
      await ctx.replyWithMarkdownV2(escapeMarkdownV2(`
  🔁 *Confirming Swap...*
  
  • Token: ${symbol}
  • Amount: ${amountFormatted} ${symbol}
  • Estimated TRX: ${estimatedTRX}
  • Slippage: ${swapTokenSlippage}%
  • Minimum After Slippage: ${minFormatted} TRX
      `));
  
      await ctx.reply("⚡ Approving use of tokens...");
      const approveTx = await tokenContract.methods.approve(CONTRACTS.ROUTER.address, swapTokenFinal.amountInWei)
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
      await ctx.reply(`⏳ Waiting for swap confirmation...\n🔗 https://tronscan.org/#/transaction/${txHash}`);
  
      // Espera y obtiene eventos del swap
      let events = null;
      for (let i = 0; i < 10; i++) {
        try {
          const { data } = await axios.get(`https://api.trongrid.io/v1/transactions/${txHash}/events`);
          if (data?.data?.length > 0) {
            events = data.data;
            break;
          }
        } catch (err) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
  
      if (!events) {
        return await ctx.reply(`⚠️ The events could not be obtained.\n🔗 https://tronscan.org/#/transaction/${txHash}`);
      }
  
      const tokenTransfer = events.find((e) =>
        e.event_name === "Transfer" &&
        e.address === path[0] &&
        e.result.from === txOwner
      );
  
      const wtrxWithdrawal = events.find((e) =>
        e.event_name === "Withdrawal" &&
        e.address === CONTRACTS.WTRX.address
      );
  
      if (!tokenTransfer || !wtrxWithdrawal) {
        return await ctx.reply("⚠️ No transfer data was found in the logs.");
      }
  
      const tokenAmount = new BigNumber(tokenTransfer.result.value)
        .dividedBy(10 ** decimals)
        .toFixed(6);
  
      const trxAmount = new BigNumber(wtrxWithdrawal.result.wad || wtrxWithdrawal.result.amount)
        .dividedBy(1e6)
        .toFixed(6);
  
      const entryPrice = new BigNumber(trxAmount)
        .dividedBy(tokenAmount)
        .toFixed(8);
  
      await ctx.replyWithMarkdownV2(escapeMarkdownV2(`
  ✅ *Swap Successful*
  
  • Swapped: ${tokenAmount} ${symbol}
  • Received: ${trxAmount} TRX
  • Entry Price: ${entryPrice} TRX/${symbol}
      `));
    } catch (error) {
      console.error("❌ Error en handleConfirmSwapToken:", error);
      await ctx.reply(`❌ Error executing swap: ${error.message}`);
    }
  };

  module.exports = {
    handleConfirmSwapToken,
    contractToken,
    swapTokenToTRX,
    handleCustomSlippageSwapToken,
    handleSlippageSelectionSwapToken,
    handleCustomAmountSwapToken,
    handleAmountSelectionSwapToken,
    amountTrxSwapToken,
    proximamente
  };