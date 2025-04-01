const { fetchAllWallets, fetch_Private_key } = require('../service/user.service');
const { decrypt, tronWeb } = require('../utils/tron');
const { Markup } = require('telegraf');

// ✅ Centralized error messages (for easy updates)
const ERROR_MESSAGES = {
  WALLET_LOAD_FAILED: "❌ Failed to load your wallets. Please try again later.",
  NO_WALLETS: "⚠️ You have no registered wallets. Create one first.",
  INVALID_TRON_ADDRESS: "🔍 Invalid TRON address. Please check and re-enter.",
  INVALID_AMOUNT: "💸 Amount must be a number ≥ 1 TRX.",
  PRIVATE_KEY_FAIL: "🔐 Failed to access this wallet's private key.",
  ADDRESS_MISMATCH: "🚨 Private key does not match the selected wallet.",
  TRANSACTION_FAILED: "⚡ Transaction failed. Reason:",
  GENERIC_ERROR: "❌ Something went wrong. Please retry.",
};

// Comando transfer modificado para iniciar el proceso de transferencia
async function transferCommand(ctx) {
  try {
    // Obtener todas las wallets del usuario
    const walletResult = await fetchAllWallets(ctx.chat.id);

    if (walletResult.success && walletResult.wallets.length > 0) {
      // Listar las wallets del usuario como botones con el nombre de la wallet
      const walletButtons = walletResult.wallets.map(wallet => {
        return [Markup.button.callback(wallet.wallet_name, `transfer_wallet_${wallet.wallet_address}`)];
      });

      // Agregar botón de cerrar al final de la lista
      walletButtons.push([Markup.button.callback('❌ Close', 'close')]);

      // Guardamos el estado de la transferencia
      ctx.session.transferState = 'waitingForWallet';

      // Enviar el mensaje con los botones de selección
      await ctx.reply('Select a wallet to transfer:', Markup.inlineKeyboard(walletButtons));
    } else {
      await ctx.reply("You don't have any registered wallets. Please create one first.");
    }
  } catch (error) {
    console.error('Error in transferCommand:', error);
    await ctx.reply('Error getting wallets.');
  }
}


// Manejador para seleccionar la wallet
async function handleWalletSelection(ctx) {
  const callbackData = ctx.update.callback_query.data;

  // Extraer la dirección de la wallet del callback_data
  const walletAddress = callbackData.replace('transfer_wallet_', '');

  // Guardar la wallet en sesión y cambiar el estado
  ctx.session.fromWallet = walletAddress;
  ctx.session.transferState = 'waitingForToAddress';
  
  await ctx.editMessageText('Please enter the wallet address you wish to transfer to:');
}

// Manejador para ingresar la dirección de destino
async function handleToAddress(ctx) {
  ctx.session.toAddress = ctx.message.text; // Guardamos la dirección en sesión
  ctx.session.transferState = 'waitingForAmount';
  
  await ctx.reply('Please enter the amount of TRX to transfer:');
}

// Manejador para ingresar el monto
async function handleAmount(ctx) {
  const amount = parseFloat(ctx.message.text);
  if (isNaN(amount) || amount < 1) {
    return ctx.reply('Please enter a valid amount greater than or equal to 1.');
  }
  ctx.session.amount = amount;

  // Realizamos la transferencia
  await transferTRX(ctx, ctx.session.fromWallet, ctx.session.toAddress, ctx.session.amount);
  
  // Limpiar la sesión después de la transferencia
  ctx.session.transferState = null;
  ctx.session.fromWallet = null;
  ctx.session.toAddress = null;
  ctx.session.amount = null;
}

// Función encargada de realizar la transferencia de TRX
// Execute TRX transfer
async function transferTRX(ctx, fromAddress, toAddress, amount) {
  try {
    // 1. Obtener clave privada
    const privateKeyResult = await fetch_Private_key(ctx.chat.id, fromAddress);
    if (!privateKeyResult.success) {
      throw new Error(ERROR_MESSAGES.PRIVATE_KEY_FAIL);
    }

    // 2. Desencriptar y verificar coincidencia
    const decryptedPrivateKey = decrypt(privateKeyResult.encryptedPrivateKey);
    const addressFromPrivateKey = tronWeb.address.fromPrivateKey(decryptedPrivateKey);
    if (addressFromPrivateKey !== fromAddress) {
      throw new Error(ERROR_MESSAGES.ADDRESS_MISMATCH);
    }

    // 3. Preparar transacción
    const amountInSun = tronWeb.toSun(amount);
    const tradeobj = await tronWeb.transactionBuilder.sendTrx(toAddress, amountInSun, fromAddress);
    const signedtxn = await tronWeb.trx.sign(tradeobj, decryptedPrivateKey);

    // 4. Enviar transacción
    const receipt = await tronWeb.trx.sendRawTransaction(signedtxn);
    if (receipt.result) {
      await ctx.reply(`✅ Sent ${amount} TRX to ${toAddress}\n\n📌 TX Hash: ${receipt.txid}`);
    } else {
      throw new Error("Network rejected the transaction");
    }

  } catch (error) {
    console.error("[ERROR] transferTRX:", error);
    
    // Manejo específico de saldo insuficiente
    if (/balance is not sufficient|insufficient balance|not enough/i.test(error.message)) {
      const balance = await tronWeb.trx.getBalance(fromAddress); // Obtener balance actual
      const balanceInTRX = tronWeb.fromSun(balance);
      
      await ctx.reply(
        `❌ Saldo insuficiente!\n` +
        `Intentaste enviar: ${amount} TRX\n` +
        `Saldo disponible: ${balanceInTRX} TRX\n\n` +
        `Recuerda considerar la comisión de red (≈0.1 TRX)`
      );
    } 
    // Otros errores
    else {
      await ctx.reply(`${ERROR_MESSAGES.TRANSACTION_FAILED} ${error.message.replace("Error:", "").trim()}`);
    }
  } finally {
    // Limpiar sesión
    ctx.session.transferState = null;
    ctx.session.fromWallet = null;
    ctx.session.toAddress = null;
    ctx.session.amount = null;
  }
}

module.exports = {
  transferCommand,
  handleWalletSelection,
  handleToAddress,
  handleAmount,
};