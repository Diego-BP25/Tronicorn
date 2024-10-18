const { fetchAllWallets, fetch_Private_key } = require('../service/user.service');
const { decrypt, tronWeb } = require('../utils/tron');
const { Markup } = require('telegraf');

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

      // Guardamos el estado de la transferencia
      ctx.session.transferState = 'waitingForWallet';
      // Enviar el mensaje con los botones de selección
      await ctx.reply('Selecciona una wallet para transferir:', ([Markup.inlineKeyboard(walletButtons)])([Markup.button.callback('❌ Close', 'close')]));
    } else {
      await ctx.reply("No tienes wallets registradas. Por favor, crea una primero.");
    }
  } catch (error) {
    console.error('Error en transferCommand:', error);
    await ctx.reply('Error al obtener wallets.');
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
  
  await ctx.reply('Por favor, ingresa la dirección de la wallet a la que deseas transferir.');
}

// Manejador para ingresar la dirección de destino
async function handleToAddress(ctx) {
  ctx.session.toAddress = ctx.message.text; // Guardamos la dirección en sesión
  ctx.session.transferState = 'waitingForAmount';
  
  await ctx.reply('Por favor, ingresa el monto de TRX a transferir.');
}

// Manejador para ingresar el monto
async function handleAmount(ctx) {
  const amount = parseFloat(ctx.message.text);
  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('Por favor, ingresa un monto válido.');
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
async function transferTRX(ctx, fromAddress, toAddress, amount) {
  try {
    // Obtener y desencriptar la clave privada de la wallet seleccionada
    const privateKeyResult = await fetch_Private_key(ctx.chat.id, fromAddress); // Cambia el argumento para usar la dirección de la wallet
    console.log(`privatekey: ${privateKeyResult}`);
    if (!privateKeyResult.success) {
      throw new Error('No se pudo obtener la clave privada');
    }
    const decryptedPrivateKey = decrypt(privateKeyResult.encryptedPrivateKey);

    // Verificar que la clave privada coincida con la dirección
    const addressFromPrivateKey = tronWeb.address.fromPrivateKey(decryptedPrivateKey);
    if (addressFromPrivateKey !== fromAddress) {
      throw new Error(`Error de coincidencia de direcciones: ${addressFromPrivateKey} != ${fromAddress}`);
    }

    // Convertir el monto a sun (1 TRX = 1,000,000 sun)
    const amountInSun = tronWeb.toSun(amount);

    // Crear la transacción
    const tradeobj = await tronWeb.transactionBuilder.sendTrx(toAddress, amountInSun, fromAddress);
    const signedtxn = await tronWeb.trx.sign(tradeobj, decryptedPrivateKey);

    // Enviar la transacción
    const receipt = await tronWeb.trx.sendRawTransaction(signedtxn);
    await ctx.reply(`Transferencia de ${amount} TRX a ${toAddress} exitosa. ID de transacción: ${receipt.txid}`);
  } catch (error) {
    console.error('Error en transferTRX:', error);
    await ctx.reply(`Error al ejecutar la transferencia: ${error.message}`);
  }
}


module.exports = {
  transferCommand,
  handleWalletSelection,
  handleToAddress,
  handleAmount,
};
