const { fetchAllWallets, fetch_Private_key } = require('../service/user.service');
const { decrypt, tronWeb } = require('../utils/tron');

async function transferCommand(ctx) {
  try {
    // Obtener wallets del usuario
    const walletResult = await fetchAllWallets(ctx.chat.id);
    if (!walletResult.success) {
      throw new Error('No se encontraron wallets');
    }

    // Mostrar botones con las wallets
    const wallets = walletResult.wallets; // Supongamos que es un array de wallets
    const buttons = wallets.map((wallet, index) => {
      return [{ text: `Wallet ${index + 1}`, callback_data: `wallet_${wallet}` }];
    });

    return ctx.reply('Selecciona una wallet para transferir:', {
      reply_markup: { inline_keyboard: buttons }
    });
  } catch (error) {
    console.error('Error en transferCommand:', error);
    return ctx.reply('Error al obtener wallets.');
  }
}

async function handleWalletSelection(ctx) {
  const walletAddress = ctx.match[1]; // Obtenemos la wallet seleccionada
  ctx.session.fromWallet = walletAddress; // Guardamos la wallet en sesión
  await ctx.reply('Por favor, ingresa la dirección de la wallet a la que deseas transferir.');
  ctx.wizard.next(); // Pasamos al siguiente paso
}

async function handleToAddress(ctx) {
  ctx.session.toAddress = ctx.message.text; // Guardamos la dirección en sesión
  await ctx.reply('Por favor, ingresa el monto de TRX a transferir.');
  ctx.wizard.next(); // Pasamos al siguiente paso
}

async function handleAmount(ctx) {
  const amount = parseFloat(ctx.message.text);
  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('Por favor, ingresa un monto válido.');
  }
  ctx.session.amount = amount;

  // Realizamos la transferencia
  await transferTRX(ctx, ctx.session.fromWallet, ctx.session.toAddress, ctx.session.amount);
  ctx.scene.leave(); // Terminamos el flujo
}

async function transferTRX(ctx, fromAddress, toAddress, amount) {
  try {
    // Obtener y desencriptar la clave privada
    const privateKeyResult = await fetch_Private_key(ctx.chat.id);
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
    ctx.reply(`Transferencia de ${amount} TRX a ${toAddress} exitosa. ID de transacción: ${receipt.txid}`);
  } catch (error) {
    console.error('Error en transferTRX:', error);
    ctx.reply(`Error al ejecutar la transferencia: ${error.message}`);
  }
}

module.exports = {
  transferCommand,
  handleWalletSelection,
  handleToAddress,
  handleAmount,
};
