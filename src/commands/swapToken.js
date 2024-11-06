const { fetchAllWallets, fetch_Private_key } = require("../service/user.service");
const { Markup } = require('telegraf');
const { decrypt } = require('../utils/tron');
const TronWeb = require('tronweb');

const fullNode = 'https://api.trongrid.io';
const solidityNode = 'https://api.trongrid.io';
const eventServer = 'https://api.trongrid.io';
const routerAddress = 'TXF1xDbVGdxFGbovmmmXvBGu8ZiE3Lq4mR'; // SunSwap V2 Router

// ABI para las funciones balanceOf, decimals y approve
const abi = [
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
        "constant": false,
        "inputs": [
            { "name": "spender", "type": "address" },
            { "name": "value", "type": "uint256" }  // Cambiado a "value" según tu definición
        ],
        "name": "approve",
        "outputs": [{ "name": "", "type": "bool" }],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    }
    // Puedes añadir más definiciones de métodos aquí si es necesario
];

// Función para manejar el comando swap de tipo tokens a TRX
async function listWallets(ctx) {
    try {
      const userId = ctx.chat.id;
  
      // Obtener todas las wallets del usuario
      const walletResult = await fetchAllWallets(userId);
  
      if (walletResult.success && walletResult.wallets.length > 0) {
        // Listar las wallets del usuario como botones
        const walletButtons = walletResult.wallets.map(wallet => {
          return [Markup.button.callback(wallet.wallet_name, `swap_wallet_token${wallet.wallet_address}`)];
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
async function handleAskToken(ctx) {
    const callbackData = ctx.update.callback_query.data;
    const addressWallet = callbackData.replace('swap_wallet_token', '');
  
    // Guardar la wallet en sesión y cambiar el estado
    ctx.session.walletFrom = addressWallet;
  
    // Recuperar la clave privada cifrada de la wallet
    const userId = ctx.chat.id;
    const privateKeyResult = await fetch_Private_key(userId, addressWallet);
  
    if (privateKeyResult.success) { 
      // Almacena la clave privada cifrada en la sesión
      ctx.session.swapData = {
        PrivateKeyencrypted: privateKeyResult.PrivateKeyencrypted,
        addressWallet
      };
      
      await ctx.reply("Please enter the token address you want to swap:");
      ctx.session.Token = true; // Marca que estamos esperando la dirección del token
    } else {
      await ctx.reply("Could not fetch the private key for this wallet. Please check your wallet details.");
    }
  }

  // Función para procesar el token de destino
async function handleAskAmount(ctx) {
    if (ctx.session.Token) {
      ctx.session.swapData.addressToken = ctx.message.text;
      ctx.session.Token = false; // Resetea la espera
      await ctx.reply("Please enter the amount of TRX to swap:");
      ctx.session.awaitingAmount = true; // Marca que estamos esperando el monto
    }
  }

  // Función para procesar el monto de TRX
async function handleProcessData(ctx) {
    if (ctx.session.awaitingAmount) {
      ctx.session.swapData.tokenAmount = ctx.message.text;
      ctx.session.awaitingAmount = false;
  
      // Llama a la función de swap con los datos proporcionados
      await approveTokens(ctx);
    }
  }

  // Función para aprobar tokens
async function approveTokens(ctx) {

    const {  addressToken, tokenAmount, PrivateKeyencrypted } = ctx.session.swapData;
    try {

        // Desencripta la clave privada
      const decryptedPrivateKey = decrypt(PrivateKeyencrypted);

        // Inicializa TronWeb con la clave privada específica de la wallet
        const tronWeb = new TronWeb(fullNode, solidityNode, eventServer, decryptedPrivateKey);
        const tokenContract = await tronWeb.contract(abi, addressToken);

        // Realiza la aprobación sin comprobar allowance
        const approveTx = await tokenContract.methods.approve(routerAddress, tokenAmount.toString()).send({
            feeLimit: 100000000
        });
        console.log('Tokens aprobados. Tx:', approveTx);
        // Llama a la función de swap con los datos proporcionados
      await swapTokenForTRX(ctx);
        
    } catch (error) {
        console.error("Error en la aprobación de tokens:", error);
    }
}

  // Función de swap final usando los datos recopilados y clave privada desencriptada
async function swapTokenForTRX(ctx) {
    const { addressWallet, addressToken, tokenAmount, PrivateKeyencrypted } = ctx.session.swapData;
  
    try {
      // Desencripta la clave privada
      const decryptedPrivateKey = decrypt(PrivateKeyencrypted);
  
  
      // Inicializa TronWeb con la clave privada específica de la wallet
      const tronWeb = new TronWeb(fullNode, solidityNode, eventServer, decryptedPrivateKey);
  
      const tokenContract = await tronWeb.contract(abi, addressToken);
        const decimales = await tokenContract.methods.decimals().call();
        const decimals = parseInt(decimales)
      
      const routerContract = await tronWeb.contract().at(routerAddress);
      const path = [
        'TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR', // Dirección de WTRX (para swaps de TRX a tokens)
        addressToken // Dirección del token objetivo proporcionado por el usuario
      ];
      const amountOutMin = 2451; // Ajusta el mínimo a recibir según tu lógica
      const recipient = addressWallet; // Usa la wallet seleccionada por el usuario
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60; // 20 minutos desde ahora
      const amountIn = Math.floor(tokenAmount * Math.pow(10, decimals));

      // Realiza el swap
      const transaction = await routerContract.methods.swapExactTokensForETH(
        amountIn.toString(),
        amountOutMin.toString(),
        path,
        recipient,
        deadline
      ).send({
        feeLimit: 200000000, 
        from: tronWeb.defaultAddress.base58,
        shouldPollResponse: true
      });
  
      await ctx.reply(`Transaction successful: ${transaction}`);
    } catch (error) {
      console.error('Error swapping TRX for tokens:', error);
      await ctx.reply("Error swapping TRX for tokens. Please check the details and try again.");
    }
  }

  module.exports = {
    listWallets,
    handleAskAmount,
    handleProcessData,
    handleAskToken
  };