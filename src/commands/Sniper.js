const { fetchAllWallets, fetch_Private_key, fetchAllUsers } = require('../service/user.service');
const { decrypt, tronWeb } = require('../utils/tron');
const { Markup } = require('telegraf');

const ADMIN_ID = process.env.ADMIN_ID 
let currentToken = null; // Variable global para almacenar el token actual
let tokenExpirationTimer = null; // Temporizador para la expiración del token

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
  try {
    if (currentToken) {
      await ctx.reply(`El token actual es: ${currentToken}\n\n📌 *Nombre:* ${tokenInfo.name} (${tokenInfo.symbol})\n💰 *Precio:* $${tokenInfo.priceUSD} USD\n🔄 *Equivalente en TRX:* ${tokenInfo.priceTRX} TRX`);
    } else {
         await ctx.reply('No hay ningún token disponible en este momento.');
    }
  } catch (error) {
    console.error('Error en listenToken:', error);
    await ctx.reply('Error al mostrar el token.');
  }}

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
    const tokenAddress = ctx.message.text.trim(); // Dirección del contrato

    // 1️⃣ Verificar si el contrato es válido y obtener información del token
    const tokenInfo = await fetchTokenInfo(tokenAddress);
    if (!tokenInfo) {
      await ctx.reply("❌ No se pudo obtener información del token. Verifica la dirección del contrato.");
      return;
    }

    // 2️⃣ Guardamos el token en la variable global
    currentToken = tokenAddress;

    // 3️⃣ Cancelamos cualquier temporizador de expiración previo
    if (tokenExpirationTimer) {
      clearTimeout(tokenExpirationTimer);
    }

    // 4️⃣ Configurar la expiración del token después de 20 minutos
    tokenExpirationTimer = setTimeout(() => {
      currentToken = null;
    }, 20 * 60 * 1000);

    // 5️⃣ Mensaje de confirmación al admin con los detalles del token
    const tokenMessage = `✅ Nuevo Token Ingresado:\n\n📌 *Nombre:* ${tokenInfo.name} (${tokenInfo.symbol})\n💰 *Precio:* $${tokenInfo.priceUSD} USD\n🔄 *Equivalente en TRX:* ${tokenInfo.priceTRX} TRX\n\n📢 Este token estará disponible para los usuarios por 20 minutos.`;

    await ctx.replyWithMarkdown(tokenMessage);

    // 6️⃣ Notificar a los usuarios
    const usersResult = await fetchAllUsers();
    if (usersResult.success && usersResult.users.length > 0) {
      for (const user of usersResult.users) {
        try {
          await ctx.telegram.sendMessage(
            user.userId,
            `🔔 *Nuevo Token Disponible*\n\n📢 Ve al menú "Sniper" y presiona "Escuchar token admin" para verlo.`,
            { parse_mode: "Markdown" }
          );
        } catch (sendError) {
          console.error(`Error notificando al usuario ${user.userId}:`, sendError);
        }
      }
    } else {
      await ctx.reply("No hay usuarios registrados en la base de datos.");
    }
  } catch (error) {
    console.error("Error al manejar el token del administrador:", error);
    await ctx.reply("Error al procesar el token.");
  }
}

async function fetchTokenInfo(contractAddress) {
  try {
    const fetch = (...args) =>
      import("node-fetch").then(({ default: fetch }) => fetch(...args));

    // 1️⃣ Obtener datos del token desde Tronscan
    const tronScanURL = `https://apilist.tronscanapi.com/api/token_trc20?contract=${contractAddress}`;
    const tronScanResponse = await fetch(tronScanURL);
    const tronScanData = await tronScanResponse.json();

    if (!tronScanData || !tronScanData.trc20_tokens || tronScanData.trc20_tokens.length === 0) {
      return null; // No se encontró el token
    }

    const token = tronScanData.trc20_tokens[0];

    // 2️⃣ Obtener el precio del token desde CoinGecko
    const tokenSymbolLower = token.symbol.toLowerCase();
    const coingeckoURL = `https://api.coingecko.com/api/v3/simple/price?ids=${tokenSymbolLower}&vs_currencies=usd`;
    const coingeckoResponse = await fetch(coingeckoURL);
    const coingeckoData = await coingeckoResponse.json();

    const priceUSD = coingeckoData[tokenSymbolLower]?.usd || 0;

    // 3️⃣ Obtener el precio de TRX en USD para calcular el equivalente
    const trxPriceURL = `https://api.coingecko.com/api/v3/simple/price?ids=tron&vs_currencies=usd`;
    const trxResponse = await fetch(trxPriceURL);
    const trxData = await trxResponse.json();
    const trxPrice = trxData.tron?.usd || 0;

    const priceTRX = trxPrice ? (priceUSD / trxPrice).toFixed(6) : "N/A";

    return {
      name: token.name,
      symbol: token.symbol,
      priceUSD: priceUSD.toFixed(6),
      priceTRX,
    };
  } catch (error) {
    console.error("Error obteniendo información del token:", error);
    return null;
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

