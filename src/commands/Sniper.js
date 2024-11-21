const { fetchAllWallets, fetch_Private_key } = require('../service/user.service');
const { decrypt, tronWeb } = require('../utils/tron');
const { Markup } = require('telegraf');

async function sniperCommand(ctx) {
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
    handleWallet
  }

