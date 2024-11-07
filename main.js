const express = require('express');
const { Telegraf } = require('telegraf');
const { swapTokens, handleWalletSwap, handleTokenAddress, handleTrxAmount, handleSwapType } = require('./src/commands/swap');
const { handleAskAmount, handleAskToken, handleProcessData, listWallets } = require('./src/commands/swapToken');
const { handleClose } = require('./src/commands/botons');
const { startCommand } = require('./src/commands/start');
const { walletCommand, createNewWallet, handleWalletName } = require('./src/commands/wallet');
const { handleWalletBalance, balanceCommand } = require('./src/commands/balance');
const { transferCommand, handleWalletSelection, handleToAddress, handleAmount } = require('./src/commands/transferTRX');
const databaseConnect = require('./src/utils/database');
const LocalSession = require('telegraf-session-local'); // Para manejo de sesión persistente

const botToken = process.env.BOT_TOKEN;
const bot = new Telegraf(botToken);
const app = express();
const PORT = process.env.PORT || 3030;

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

    // Comando de swap
    bot.command('swap', swapTokens);

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

    bot.action('transfer', async (ctx) => {
      await ctx.answerCbQuery();  // Responder al callback query
      return transferCommand(ctx);  // Llamar a la función de la transferencia
    });

    bot.action(/^transfer_wallet_.+$/, handleWalletSelection);

    bot.action('swap', async (ctx) => {
      await ctx.answerCbQuery();  // Responder al callback query
      return handleWalletSwap(ctx);  // Llamar a la función de la transferencia
    });

    // Acción para el botón de swap inicial
  bot.action('swap', async (ctx) => {
    await ctx.answerCbQuery();
    return handleWalletSwap(ctx);
  });

  // Acción para el tipo de swap TRX a Tokens
  bot.action(/^swap_type_TRX_TOKENS$/, async (ctx) => {
    await ctx.answerCbQuery();
    return swapTokens(ctx);
  });

  // Acción para seleccionar una wallet
  bot.action(/^swap_wallet_.+$/, async (ctx) => {
    await ctx.answerCbQuery();
    return handleSwapType(ctx);
  });

  // Acción para el tipo de swap tokens a TRX
  bot.action(/^swap_type_TOKENS_TRX$/, async (ctx) => {
    await ctx.answerCbQuery();
    return listWallets(ctx);
  });

    // Acción para seleccionar una wallet
    bot.action(/^swap_wallet_.+$/, async (ctx) => {
      await ctx.answerCbQuery();
      return handleAskToken(ctx);
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
    return handleTokenAddress(ctx);
  }

  if (ctx.session.awaitingTrxAmount) {
    return handleTrxAmount(ctx);
  }

  if (ctx.session.Token) {
    return handleAskAmount(ctx);
  }

  if (ctx.session.awaitingAmount) {
    return handleProcessData(ctx);
  }
});


    // Manejador para el botón "Close"
    bot.action('close', handleClose);

    // Webhook para recibir actualizaciones, (render)
    bot.telegram.setWebhook(`https://tronbot-1eu6.onrender.com/bot${botToken}`);

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
