const express = require('express');
const { Telegraf } = require('telegraf');
const { handleWalletSwap, handleSwapType, amountTrxSwap, handleAmountSelectionSwap,handleCustomAmountSwap, handleSlippageSelectionSwap, handleCustomSlippageSwap,executeSwap, SwapYes, SwapNo } = require('./src/commands/swap');
const {handleAmountSelectionSwapToken,handleCustomAmountSwapToken, amountTrxSwapToken,handleSlippageSelectionSwapToken, handleCustomSlippageSwapToken, swapTokenToTRX,contractToken,handleConfirmSwapToken,SwapTokenNo} = require('./src/commands/swapToken')
const { handleClose } = require('./src/commands/botons');
const { startCommand } = require('./src/commands/start');
const { walletCommand, createNewWallet, handleWalletName } = require('./src/commands/wallet');
const { handleWalletBalance, balanceCommand } = require('./src/commands/balance');
const { transferCommand, handleWalletSelection, handleToAddress, handleAmount } = require('./src/commands/transferTRX');
const {sniperCommand, amountTrx, listenToken, sendToken, handleAdminToken, handlewalletSelection, handleAmountSelection, handleSlippageSelection, handleCustomAmount,handleCustomSlippage } = require ('./src/commands/Sniper')
const {External} = require('./src/commands/external')
const { stableCoins, listUserWallets, handleReceive, handleSend, handleExternalWalletInput,desarrollo} = require('./src/commands/stablecoins')
const databaseConnect = require('./src/utils/database');
const LocalSession = require('telegraf-session-local'); // Para manejo de sesión persistente

const botToken = process.env.BOT_TOKEN;
const bot = new Telegraf(botToken);
const app = express();
const PORT = process.env.PORT || 1000;

// Middleware de sesión persistente
const localSession = new LocalSession({ database: 'sessions.json' });
bot.use(localSession.middleware());  // Usar la sesión persistente

(async () => {
  try {
    await databaseConnect();
    console.log('Database connected successfully');

    // Comandos del bot
    bot.start(startCommand);

    // Comando /wallet
    bot.command("wallet", walletCommand);

    // Comando /balance
    bot.command('balance', balanceCommand);

    // Manejadores para botones de callback
    bot.action('wallet', async (ctx) => {
      await ctx.answerCbQuery();  // Responder al callback query
      return walletCommand(ctx);  // Llamar a la función de la wallet
    });

    bot.action('new_wallet', createNewWallet);

    bot.action('balance', async (ctx) => {
      await ctx.answerCbQuery();  // Responder al callback query
      return balanceCommand(ctx);  // Llamar a la función de balance
    });

    bot.action(/^wallet_balance_/, handleWalletBalance);

//-----------------------------external------------------------

    bot.action('external', async (ctx) => {
      await ctx.answerCbQuery();  // Responder al callback query
      return External(ctx);  // Llamar a la función de balance
    });

  //-----------------------------stableCoins------------------------

  bot.action("stableCoins", async (ctx) => {
    await stableCoins(ctx);
  });

  bot.action('external_wallet', async (ctx) => {
    ctx.session.transferMode = "receive"; // o "send" si estás en modo de envío
    ctx.session.awaitingExternalWallet = true;
    await ctx.reply("🔍 Please enter the wallet address you want to use:");
  });
  

    bot.action("receive_payment", async (ctx) => {
      ctx.session.transferMode = "receive";
      await listUserWallets(ctx);
    });
    
    bot.action("send_payment", async (ctx) => {
      ctx.session.transferMode = "send";
      await desarrollo(ctx);
    });
    

    bot.action(/select_wallet_(.+)/, async (ctx) => {
      const walletAddress = ctx.match[1];
      const mode = ctx.session.transferMode;
    
      if (mode === "receive") {
        return handleReceive(ctx, walletAddress);
      } else if (mode === "send") {
        return handleSend(ctx, walletAddress);
      } else {
        return ctx.reply("⚠️ Unknown operation. Please try again.");
      }
    });
    
//-----------------------------transferTRX------------------------
    bot.action('transfer', async (ctx) => {
      await ctx.answerCbQuery();  // Responder al callback query
      return transferCommand(ctx);  // Llamar a la función de la transferencia
    });

    bot.action(/^transfer_wallet_.+$/, handleWalletSelection);


//-----------------------------swap------------------------

    bot.action('swap', async (ctx) => {
      await ctx.answerCbQuery();  // Responder al callback query
      return handleWalletSwap(ctx);  // Llamar a la función de la transferencia
    });

    // Acción para el botón de swap inicial
  bot.action('swap', async (ctx) => {
    await ctx.answerCbQuery();
    return handleWalletSwap(ctx);
  });

  bot.action(/swap_amount_.+$/, handleAmountSelectionSwap);

  bot.action(/swap_slippage_.+$/, handleSlippageSelectionSwap);

  // Acción para el tipo de swap TRX a Tokens
  bot.action(/^swap_type_TRX_TOKENS$/, async (ctx) => {
    await ctx.answerCbQuery();
    return amountTrxSwap(ctx);
  });

  bot.action('swap_type_TRX_TOKENS', async (ctx) => {
    await ctx.answerCbQuery();
    return amountTrxSwap(ctx);
  });

  // Acción para seleccionar una wallet
  bot.action(/^swap_wallet_.+$/, async (ctx) => {
    await ctx.answerCbQuery();
    return handleSwapType(ctx);
  });

  // Acción para confirmar swap 
  bot.action("confirm_swap_yes", async (ctx) => {
    await ctx.answerCbQuery();
    return SwapYes(ctx);
  });

  // Acción para cancelar swap 
  bot.action("confirm_swap_no", async (ctx) => {
    await ctx.answerCbQuery();
    return SwapNo(ctx);
  });

    // Acción para seleccionar una wallet
    bot.action(/^token_wallet_.+$/, async (ctx) => {
      await ctx.answerCbQuery();
      return handleAskToken(ctx);
    });

//-----------------------------swapToken------------------------
  // Acción para el tipo de swap tokens a TRX
  bot.action(/^swap_type_TOKENS_TRX$/, async (ctx) => {
    await ctx.answerCbQuery();
    return amountTrxSwapToken(ctx);
  });
  
  bot.action(/swapToken_amount_.+$/, handleAmountSelectionSwapToken);

  bot.action(/swapToken_slippage_.+$/, handleSlippageSelectionSwapToken);

  bot.action(/^swapToken_wallet_.+$/, async (ctx) => {
    await ctx.answerCbQuery();
    return contractToken(ctx);
  });

  bot.action('confirm_swapToken', handleConfirmSwapToken);

  bot.action('cancel_swapToken', SwapTokenNo);


//--------------sniper-----------------------
    bot.action('sniper', async (ctx) => {
      await ctx.answerCbQuery();
      return sniperCommand(ctx);
    });

    // Escuchar token enviado por admin
bot.action('ConfigPump', async (ctx) => {
  await ctx.answerCbQuery();
  return amountTrx(ctx);
});

// Ingresar token manualmente
bot.action('sniper_enter', async (ctx) => {
  await ctx.answerCbQuery();
  return sniperManual(ctx);
});

// escuchar token de admin
bot.action('sniper_listen', async (ctx) => {
  await ctx.answerCbQuery();
  return listenToken(ctx);
});

// Enviar token a todos los usuarios
bot.action('sniper_send', async (ctx) => {
  await ctx.answerCbQuery();
  return sendToken(ctx);
});

bot.action(/^sniper_wallet_.+$/, handlewalletSelection);

bot.action(/sniper_amount_.+$/, handleAmountSelection);

bot.action(/sniper_slippage_.+$/, handleSlippageSelection);

//--------------boton cancelar-----------------------

bot.action('cancel_flow', async (ctx) => {
  if (ctx.session.messageFlow) {
    for (const msgId of ctx.session.messageFlow) {
      try {
        await ctx.deleteMessage(msgId);
      } catch (e) {
        console.warn('No se pudo borrar el mensaje:', e.message);
      }
    }
    ctx.session.messageFlow = [];
  }
  await ctx.answerCbQuery('Cancelled');
});



    // Manejador de texto para creación de wallet (cuando se espera el nombre de la wallet)
bot.on('text', async (ctx) => {
  if (ctx.session.waitingForWalletName) {
    return handleWalletName(ctx);  // Manejador de nombre de wallet
  }

  // Verificar el estado de la transferencia
  if (ctx.session.transferState === 'waitingForToAddress') {
    return handleToAddress(ctx);   // Manejador de dirección destino para transferencias
  }

  if (ctx.session.transferState === 'waitingForAmount') {
    return handleAmount(ctx);      // Manejador de monto para transferencias
  }

  if (ctx.session.awaitingTokenAddress) {
    return executeSwap(ctx);
  }

  if (ctx.session.awaitingSlippage) {
    return handleCustomSlippageSwap(ctx);
  }

  if (ctx.session.awaitingTrxAmount) {
    return handleCustomAmountSwap(ctx);
  }

  if (ctx.session.Token) {
    return handleAskAmount(ctx);
  }

  if (ctx.session.awaitingAmount) {
    return handleProcessData(ctx);
  }

  if (ctx.session.sniperState === 'waitingForAdminToken') {
    await handleAdminToken(ctx);
    ctx.session.sniperState = null; // Limpiar estado después de manejar el token
  } else if (ctx.session.sniperState === 'waitingForToken') {
    await ctx.reply(`Token ingresado: ${ctx.message.text}`);
    ctx.session.sniperState = null; // Limpiar estado
  }

  if (ctx.session.sniperState === 'waitingForCustomAmount') {
    return handleCustomAmount(ctx);
  }

  if (ctx.session.sniperState === 'waitingForCustomSlippage') {
    return handleCustomSlippage(ctx);
  }

  if (ctx.session.sniperState === 'waitingForCustomAmountSwap') {
    return handleCustomAmountSwap(ctx);
  }

  if (ctx.session.sniperState === 'waitingForCustomSlippageSwap') {
    return handleCustomSlippageSwap(ctx);
  }

  if (ctx.session.awaitingExternalWallet) {
    return handleExternalWalletInput(ctx);
  }

  if (ctx.session.awaitingTokenAmount) {
    return handleCustomAmountSwapToken(ctx);
  }

  if (ctx.session.awaitingSlippageToken) {
    return handleCustomSlippageSwapToken(ctx);
  }

  if (ctx.session.awaitingTokenSwap) {
    return swapTokenToTRX(ctx);
  }
  
});


    // Manejador para el botón "Close"
    bot.action('close', handleClose);

    // Webhook para recibir actualizaciones, (render)
    bot.telegram.setWebhook(`https://tronicorn-dev.onrender.com/bot${botToken}`);

    // Usar Express para manejar peticiones HTTP para el webhook
    app.use(bot.webhookCallback(`/bot${botToken}`));

    // Servidor Express escuchando en el puerto configurado
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    console.log('Bot is running with webhook...');

  } catch (error) {
    console.error('Failed to connect to the database:', error);
    process.exit(1);
  }
})();
