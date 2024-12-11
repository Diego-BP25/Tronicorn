const { fetchAllWallets, fetch_Private_key, fetchAllUsers } = require('../service/user.service');
const { decrypt, tronWeb } = require('../utils/tron');
const { Markup } = require('telegraf');

const ADMIN_ID = process.env.ADMIN_ID 

async function sniperCommand(ctx) {
  try {
    const isAdmin = ctx.chat.id.toString() === ADMIN_ID;

    // Opciones iniciales dependiendo si es admin o no
    const buttons = [
      [Markup.button.callback('Escuchar token admin', 'sniper_listen')],
      [Markup.button.callback('Ingresar token', 'sniper_enter')],
    ];

    if (isAdmin) {
      buttons.push([Markup.button.callback('Enviar token a usuarios', 'sniper_send')]);
    }

    await ctx.reply('Selecciona una opción:', Markup.inlineKeyboard(buttons));
  } catch (error) {
    console.error('Error en sniperCommand:', error);
    await ctx.reply('Error al ejecutar el comando sniper.');
  }
}

// Escuchar token enviado por el administrador
async function listenToken(ctx) {
  await ctx.reply('Esperando token del administrador...');
}

// Enviar token a todos los usuarios registrados
async function sendToken(ctx) {
  try {
    const isAdmin = ctx.chat.id.toString() === ADMIN_ID;

    if (!isAdmin) {
      await ctx.reply('No tienes permisos para realizar esta acción.');
      return;
    }

    ctx.session.sniperState = 'waitingForAdminToken';
    await ctx.reply('Por favor, ingresa el token que deseas enviar a todos los usuarios.');
  } catch (error) {
    console.error('Error en sendToken:', error);
    await ctx.reply('Error al enviar el token.');
  }
}


// Manejar token enviado por el administrador
async function handleAdminToken(ctx) {
  try {
    const token = ctx.message.text;

    // Obtener todos los usuarios registrados
    const usersResult = await fetchAllUsers();

    if (usersResult.success && usersResult.users.length > 0) {
      for (const user of usersResult.users) {
        try {
          // Enviar el token a cada usuario
          await ctx.telegram.sendMessage(user.chat_id, `Token recibido del administrador: ${token}`);
        } catch (sendError) {
          console.error(`Error enviando token al usuario ${user.chat_id}:`, sendError);
        }
      }

      await ctx.reply('El token ha sido enviado a todos los usuarios registrados.');
    } else {
      await ctx.reply('No hay usuarios registrados en la base de datos.');
    }
  } catch (error) {
    console.error('Error al manejar el token del administrador:', error);
    await ctx.reply('Error al procesar el token.');
  }
}

async function sniperComma(ctx) {
    try {
      // Obtener todas las wallets del usuario
      const walletResult = await fetchAllWallets(ctx.chat.id);
  
      if (walletResult.success && walletResult.wallets.length > 0) {
        // Listar las wallets del usuario como botones con el nombre de la wallet
        const walletButtons = walletResult.wallets.map(wallet => {
          return [Markup.button.callback(wallet.wallet_name, `sniper_${wallet.wallet_address}`)];
        });
  
        // Guardamos el estado de la transferencia
        ctx.session.sniperState = 'waitingForWallet';
        // Enviar el mensaje con los botones de selección
        await ctx.reply('Selecciona una wallet para realizar el sniper:', Markup.inlineKeyboard(walletButtons));
      } else {
        await ctx.reply("No tienes wallets registradas. Por favor, crea una primero.");
      }
    } catch (error) {
      console.error('Error en SniperCommand:', error);
      await ctx.reply('Error al obtener wallets.');
    }
  }

  // Manejador para ingresar la dirección de destino
async function handleWallet(ctx) {
    // Extraer la dirección de la wallet del callback_data
  const walletAddress = callbackData.replace('sniper_', '');
  // Guardar la wallet en sesión y cambiar el estado
  ctx.session.fromWallet = walletAddress;
    ctx.session.sniperState = 'waitingForAmount';
    
    await ctx.reply('Por favor, Ingresa la cantidad de trx a invertir en el pump.');
  }

  module.exports = {
    sniperCommand,
    handleWallet,
    listenToken,
    sendToken,
    handleAdminToken
  }

