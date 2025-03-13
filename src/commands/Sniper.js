const { fetchAllWallets, fetch_Private_key, fetchAllUsers } = require('../service/user.service');
const { decrypt, tronWeb } = require('../utils/tron');
const { Markup } = require('telegraf');

const ADMIN_ID = process.env.ADMIN_ID 
let currentToken = null; // Variable global para almacenar el token actual
let tokenExpirationTimer = null; // Temporizador para la expiración del token
let TokenName= null;
let TokenSymbol= null
let TokenUsdt= null
let TokenTrx= null

async function sniperCommand(ctx) {
  try {
    const isAdmin = ctx.chat.id.toString() === ADMIN_ID;

    // Opciones iniciales dependiendo si es admin o no

    // botones para token
    const buttons = [
    //   [Markup.button.callback('Escuchar token admin', 'sniper_listen')],
    //   [Markup.button.callback('Ingresar token', 'sniper_enter')],
    [Markup.button.callback('⚙ Configurar pump', 'ConfigPump')]
  ];

    if (isAdmin) {
      buttons.push([Markup.button.callback('Enviar token a usuarios', 'sniper_send')]);
    }

    await ctx.reply('Configura los parametros de tu pump',Markup.inlineKeyboard(buttons));
  } catch (error) {
    console.error('Error en sniperCommand:', error);
    await ctx.reply('Error al ejecutar el comando sniper.');
  }
}

  // Manejador para ingresar la cantidad de TRX a invertir en el pump
async function amountTrx(ctx) {
  try {
    // Extraer la dirección de la wallet del callback_data
    //const callbackData = ctx.update.callback_query.data;
    //const walletAddress = callbackData.replace('sniper_', '');

    // Guardar la wallet en sesión y cambiar el estado
    // ctx.session.fromWallet = walletAddress;
    // ctx.session.sniperState = 'waitingForAmount';

    // Crear los botones en el formato deseado
    const buttons = Markup.inlineKeyboard([
      [
        Markup.button.callback('5 TRX', 'sniper_amount_5'),
        Markup.button.callback('10 TRX', 'sniper_amount_10'),
        Markup.button.callback('20 TRX', 'sniper_amount_20')
      ],
      [Markup.button.callback('✏️ Personalizar', 'sniper_amount_custom')] // Botón debajo
    ]);

    await ctx.reply('Elija el monto en trx con el que desea hacer el pump',buttons);
  } catch (error) {
    console.error('Error en amountTrx:', error);
    await ctx.reply('Ocurrió un error al solicitar la cantidad de TRX.');
  }
}


// Manejador para la selección del monto
async function handleAmountSelection(ctx) {
  const selectedAmount = ctx.match[0].replace('sniper_amount_', '');

  if (selectedAmount === 'custom') {
    // Si elige personalizar, pedir el monto
    ctx.session.sniperState = 'waitingForCustomAmount';
    await ctx.reply('Por favor, ingresa la cantidad de TRX a invertir en el pump:');
  } else {
    // Guardar el monto seleccionado en sesión y pasar a la selección del deslizamiento
    ctx.session.sniperAmount = selectedAmount;
    await showSlippageOptions(ctx);
  }
}

// Función para mostrar opciones de deslizamiento
async function showSlippageOptions(ctx) {
  const buttons = Markup.inlineKeyboard([
    [
      Markup.button.callback('5%', 'sniper_slippage_5'),
      Markup.button.callback('10%', 'sniper_slippage_10'),
      Markup.button.callback('20%', 'sniper_slippage_20')
    ],
    [Markup.button.callback('✏️ Personalizar', 'sniper_slippage_custom')]
  ]);

  await ctx.reply('Selecciona el porcentaje de deslizamiento:', buttons);
}

// Manejador para la entrada de monto personalizado
async function handleCustomAmount(ctx) {
  if (ctx.session.sniperState === 'waitingForCustomAmount') {
    ctx.session.sniperAmount = ctx.message.text; // Guardar el monto ingresado
    ctx.session.sniperState = null; // Resetear estado
    await showSlippageOptions(ctx); // Pasar al siguiente paso
  }
}

// Manejador para la selección del deslizamiento
async function handleSlippageSelection(ctx) {
  const selectedSlippage = ctx.match[0].replace('sniper_slippage_', '');

  if (selectedSlippage === 'custom') {
    ctx.session.sniperState = 'waitingForCustomSlippage';
    await ctx.reply('Por favor, ingresa el porcentaje de deslizamiento:');
  } else {
    ctx.session.sniperSlippage = selectedSlippage;
    await ctx.reply(`Configuración completada ✅\n\n🔹 Monto: ${ctx.session.sniperAmount} TRX\n🔹 Deslizamiento: ${selectedSlippage}%`);
  }
}

// Manejador para la entrada de deslizamiento personalizado
async function  handleCustomSlippage(ctx) {
  if (ctx.session.sniperState === 'waitingForCustomSlippage') {
    ctx.session.sniperSlippage = ctx.message.text;
    ctx.session.sniperState = null;
    await ctx.reply(`Configuración completada ✅\n\n🔹 Monto: ${ctx.session.sniperAmount} TRX\n🔹 Deslizamiento: ${ctx.session.sniperSlippage}%`);
  }
}


// Escuchar token enviado por el administrador
async function listenToken(ctx) {
  try {
    if (currentToken) {
      await ctx.editMessageText(`El contrato actual es: ${currentToken}\n\n📌 *Nombre:* ${TokenName} (${TokenSymbol})\n💰 *Precio:* $${TokenUsdt} USD\n🔄 *Equivalente en TRX:* ${TokenTrx} TRX`, { parse_mode: "Markdown" });
    } else {
         await ctx.editMessageText('No hay ningún token disponible en este momento.');
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
      await ctx.editMessageText('No tienes permisos para realizar esta acción.');
      return;
    }

    ctx.session.sniperState = 'waitingForAdminToken';
    await ctx.editMessageText('Por favor, ingresa el token que deseas enviar a todos los usuarios.');
  } catch (error) {
    console.error('Error en sendToken:', error);
    await ctx.editMessageText('Error al enviar el token.');
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
    TokenName = tokenInfo.name
    TokenSymbol = tokenInfo.symbol
    TokenUsdt = tokenInfo.priceUSD
    TokenTrx = tokenInfo.priceTRX
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
      await ctx.editMessageText("No hay usuarios registrados en la base de datos.");
    }
  } catch (error) {
    console.error("Error al manejar el token del administrador:", error);
    await ctx.editMessageText("Error al procesar el token.");
  }
}
async function fetchTokenInfo(currentToken) {
  try {
    const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

    // URLs de APIs
    const tronScanURL = `https://apilist.tronscanapi.com/api/token_trc20?contract=${currentToken}`;
    const coingeckoTokenURL = `https://api.coingecko.com/api/v3/simple/token_price/tron?contract_addresses=${currentToken}&vs_currencies=usd`;
    const coingeckoTrxURL = `https://api.coingecko.com/api/v3/simple/price?ids=tron&vs_currencies=usd`;

    // Fetch de datos
    const [tokenResponse, trxResponse, tronScanResponse] = await Promise.all([
      fetch(coingeckoTokenURL),
      fetch(coingeckoTrxURL),
      fetch(tronScanURL)
    ]);

    const tokenData = await tokenResponse.json();
    const trxData = await trxResponse.json();
    const tronScanData = await tronScanResponse.json();

    // Obtener precio del token en USD
    const priceUSD = tokenData[currentToken]?.usd || 0;

    // Obtener precio del TRX en USD
    const priceTRXInUSD = trxData.tron?.usd || 0;

    if (!tronScanData || !tronScanData.trc20_tokens || tronScanData.trc20_tokens.length === 0) {
      return null;
    }

    // Extraer datos del token
    const token = tronScanData.trc20_tokens[0];
    const name = token.name || "Desconocido";
    const symbol = token.symbol || "Desconocido";

    // Calcular el precio del token en TRX
    const priceTRX = priceTRXInUSD > 0 ? (priceUSD / priceTRXInUSD).toFixed(6) : "0";

    return {
      name,
      symbol,
      priceUSD: priceUSD.toString(),
      priceTRX: priceTRX.toString()
    };
  } catch (error) {
    console.error("❌ Error obteniendo información del token:", error);
    return null;
  }
}


async function sniperManual(ctx) {
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


  module.exports = {
    sniperCommand,
    amountTrx,
    listenToken,
    sendToken,
    handleAdminToken,
    sniperManual,
    handleAmountSelection,
    handleCustomAmount,
    handleSlippageSelection,
    handleCustomSlippage
  }

