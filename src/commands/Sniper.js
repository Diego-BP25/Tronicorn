const { fetchAllWallets, fetch_Private_key, fetchAllUsers } = require('../service/user.service');
const { decrypt, tronWeb } = require('../utils/tron');
const { Markup } = require('telegraf');
const { clearAllSessionFlows } = require('./clearSessions');


const ADMIN_ID = process.env.ADMIN_ID 
let currentToken = null; // Variable global para almacenar el token actual
let tokenAvailableTime = null; //almacenar la hora exacta en la que será visible el token.
let TokenName= null;
let TokenSymbol= null
let TokenUsdt= null
let TokenTrx= null
let tronScanLink = null;


async function sniperCommand(ctx) {
  try {
    clearAllSessionFlows(ctx);
    const isAdmin = ctx.chat.id.toString() === ADMIN_ID;

    // botones para token
    const buttons = [
    [Markup.button.callback('⚙ Configure pump', 'ConfigPump')]
  ];

    if (isAdmin) {
      buttons.push([Markup.button.callback('Activate token', 'sniper_send')]);
    }

    await ctx.reply('Configure your pump parameters',Markup.inlineKeyboard(buttons));
  } catch (error) {
    console.error('Error en sniperCommand:', error);
    await ctx.reply('Error al ejecutar el comando sniper.');
  }
}

  // Manejador para ingresar la cantidad de TRX a invertir en el pump
async function amountTrx(ctx) {
  try {

    // Crear los botones en el formato deseado
    const buttons = Markup.inlineKeyboard([
      [
        Markup.button.callback('5 TRX', 'sniper_amount_5'),
        Markup.button.callback('10 TRX', 'sniper_amount_10'),
        Markup.button.callback('20 TRX', 'sniper_amount_20')
      ],
      [Markup.button.callback('✏️ Personalize', 'sniper_amount_custom')] // Botón debajo
    ]);

    await ctx.reply('Choose the amount in TRX you want to pump with',buttons);
  } catch (error) {
    console.error('Error in amountTrx:', error);
    await ctx.reply('Ocurrió un error al solicitar la cantidad de TRX.');
  }
}


// Manejador para la selección del monto
async function handleAmountSelection(ctx) {
  const selectedAmount = ctx.match[0].replace('sniper_amount_', '');

  if (selectedAmount === 'custom') {
    // Si elige personalizar, pedir el monto
    ctx.session.sniperState = 'waitingForCustomAmount';
    await ctx.reply('Please enter the amount of TRX to invest in the pump:');
  } else {
    // Guardar el monto seleccionado en sesión y pasar a la selección del deslizamiento
    ctx.session.sniperAmount = selectedAmount;
    ctx.session.sniperState = 'waitingForSlippage'; 
    await showSlippageOptions(ctx);
  }
}

// Manejador para la entrada de monto personalizado
async function handleCustomAmount(ctx) {
  if (ctx.session.sniperState === 'waitingForCustomAmount') {
    ctx.session.sniperAmount = ctx.message.text; // Guardar el monto ingresado
    ctx.session.sniperState = null; // Resetear estado
    await showSlippageOptions(ctx); // Pasar al siguiente paso
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
    [Markup.button.callback('✏️ Personalize', 'sniper_slippage_custom')]
  ]);

  await ctx.reply('Select the sliding percentage:', buttons);
}

// Manejador para la selección del deslizamiento
async function handleSlippageSelection(ctx) {
  const selectedSlippage = ctx.match[0].replace('sniper_slippage_', '');

  if (selectedSlippage === 'custom') {
    ctx.session.sniperState = 'waitingForCustomSlippage';
    await ctx.reply('Please enter the slip percentage:');
  } else {
    ctx.session.sniperSlippage = selectedSlippage;
    ctx.session.sniperState = null;
    await selectWallet(ctx);
  }
}

// Manejador para la entrada de deslizamiento personalizado
async function  handleCustomSlippage(ctx) {
  if (ctx.session.sniperState === 'waitingForCustomSlippage') {
    ctx.session.sniperSlippage = ctx.message.text;
    ctx.session.sniperState = null;
    await selectWallet(ctx);
    
  }
}

async function selectWallet(ctx) {
  try {
    // Obtener todas las wallets del usuario
    const walletResult = await fetchAllWallets(ctx.chat.id);

    if (walletResult.success && walletResult.wallets.length > 0) {
      // Listar las wallets del usuario como botones con el nombre de la wallet
      const walletButtons = walletResult.wallets.map(wallet => {
        return [Markup.button.callback(wallet.wallet_name, `sniper_wallet_${wallet.wallet_address}`)];
      });

      // Enviar el mensaje con los botones de selección
      await ctx.reply('Select a wallet to perform the sniper:', Markup.inlineKeyboard(walletButtons));
      ctx.session.sniperState = null;


    } else {
      await ctx.reply("You don't have any registered wallets. Please create one first..");
    }
  } catch (error) {
    console.error('Error en SniperCommand:', error);
    await ctx.reply('Error al obtener wallets.');
  }
}

async function handlewalletSelection(ctx) {
  const selectedWallet = ctx.match[0].replace('sniper_wallet_', '');

  // Guardar la wallet en la sesión
  ctx.session.wallet = selectedWallet;
  ctx.session.sniperState = null;
  // Continuar con el siguiente paso (typePump)
  await typePump(ctx);
  
}

async function typePump(ctx) {
  try {

    // botones para token
    const buttons = [
       [Markup.button.callback('Activate token', 'sniper_listen')],
       [Markup.button.callback('Custom token', 'sniper_enter')],
  ];
   tronScanLink = `https://tronscan.org/#/address/${ctx.session.wallet}`;

    await ctx.reply(`Complete configuration ✅\n🔹 amount: ${ctx.session.sniperAmount} TRX\n🔹 Slippage: ${ctx.session.sniperSlippage}%\n🔹 Wallet: ${ctx.session.wallet}\n[🔗 View on Tronscan](${tronScanLink})\n\nNow select what type of contract you want to pump with.`,Markup.inlineKeyboard(buttons));
  } catch (error) {
    console.error('Error en sniperCommand:', error);
    await ctx.reply('Error al ejecutar el comando sniper.');
  }
}

// ✅ Función para que los usuarios escuchen el token cuando ya está disponible
async function listenToken(ctx) {
  try {
    if (currentToken) {
      await ctx.reply(
        `📢 *New Token Available*\n\n📌 *Name:* ${TokenName} (${TokenSymbol})\n💰 *Price:* $${TokenUsdt} USD\n🔄 *Equivalent in TRX:* ${TokenTrx} TRX\n\n📜 *contract:* ${currentToken}`,
        { parse_mode: "Markdown" }
      );
    } else if (tokenAvailableTime) {
      // Mostrar la hora programada si el token aún no es visible
      const formattedTime = new Intl.DateTimeFormat("es-CO", {
        timeZone: "America/Bogota",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }).format(tokenAvailableTime);
      await ctx.reply(`⏳ The contract will be available at *${formattedTime} (Colombian time)*.`, { parse_mode: "Markdown" });
    } else {
      await ctx.reply("🚫 There are no active contracts at this time..");
    }
  } catch (error) {
    console.error("Error en listenToken:", error);
    await ctx.reply("Error displaying token.");
  }
}

// Enviar token a todos los usuarios registrados
async function sendToken(ctx) {
  try {
    const isAdmin = ctx.chat.id.toString() === ADMIN_ID;

    if (!isAdmin) {
      await ctx.editMessageText('You do not have permission to perform this action.');
      return;
    }

    ctx.session.sniperState = 'waitingForAdminToken';
    await ctx.editMessageText('Please enter the token you want to send to all users.');
  } catch (error) {
    console.error('Error en sendToken:', error);
    await ctx.editMessageText('Error sending token.');
  }
}


// ✅ Función para manejar el token enviado por el administrador
async function handleAdminToken(ctx) {
  try {
    const tokenAddress = ctx.message.text.trim();

    // 1️⃣ Verificar si el contrato es válido
    const tokenInfo = await fetchTokenInfo(tokenAddress);
    if (!tokenInfo) {
      await ctx.reply("❌ Contract information could not be obtained.");
      return;
    }
    console.log("Token Info:", tokenInfo);


    // 2️⃣ Configurar el tiempo de disponibilidad
    tokenAvailableTime = new Date(Date.now() + 30 * 60 * 1000);

    // 3️⃣ Guardar la información del token
    TokenName = tokenInfo.name;
    TokenSymbol = tokenInfo.symbol;
    TokenUsdt = tokenInfo.priceUSD;
    TokenTrx = tokenInfo.priceTRX;
    tronScanLink = `https://tronscan.org/#/address/${ctx.session.wallet}`;


    // 4️⃣ Notificar al admin
    const tokenMessage = `✅ Active contract:\n\n📌 *Name:* ${TokenName} (${TokenSymbol})\n💰 *Price:* $${TokenUsdt} USD\n🔄 *Equivalent in TRX:* ${TokenTrx} TRX\n[🔗 View on Tronscan](${tronScanLink})\n\n⏳ *This contract becomes active in 30 minutes.*`;
    await ctx.replyWithMarkdown(tokenMessage);

    // 5️⃣ Notificar a los usuarios con la hora exacta
    const formattedTime = new Intl.DateTimeFormat("es-CO", {
      timeZone: "America/Bogota",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(tokenAvailableTime);

    const usersResult = await fetchAllUsers();
    if (usersResult.success && usersResult.users.length > 0) {
      for (const user of usersResult.users) {
        try {
          await ctx.telegram.sendMessage(
            user.userId,
            `🔔 *New contract scheduling*\n\n📢 The contract will be available at *${formattedTime} (Colombian time)*.\n\nStay tuned!`,
            { parse_mode: "Markdown" }
          );
        } catch (sendError) {
          console.error(`Error notifying user ${user.userId}:`, sendError);
        }
      }
    }

    // Hacer visible el token después de 30 min y eliminarlo después de 2 min
    setTimeout(() => {
      currentToken = tokenAddress;
      tokenAvailableTime = null;

      // Configurar eliminación del token en 2 minutos
      setTimeout(() => {
        currentToken = null;
      }, 2 * 60 * 1000); 

    }, 30 * 60 * 1000); 
  } catch (error) {
    console.error("Error al manejar el token del administrador:", error);
    await ctx.reply("❌ Error al procesar el token.");
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
    console.log("🔍 CoinGecko tokenData:", JSON.stringify(tokenData, null, 2));
    
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


  module.exports = {
    sniperCommand,
    amountTrx,
    listenToken,
    sendToken,
    handleAdminToken,
    handleAmountSelection,
    handleCustomAmount,
    handleSlippageSelection,
    handleCustomSlippage,
    handlewalletSelection
  }

