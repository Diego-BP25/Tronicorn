const express = require('express');
const { Telegraf } = require('telegraf');
const { swapTokens} = require('./src/commands');
const { startCommand } = require('./src/commands/start');
const { walletCommand, createNewWallet, handleWalletName } = require('./src/commands/wallet');
const { handleWalletBalance, balanceCommand} = require('./src/commands/balance');
const { transferCommand, handleWalletSelection, handleToAddress, handleAmount} = require('./src/commands/transferTRX');
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

     // Aquí están los manejadores para los botones de callback del menú
     bot.action('wallet', async (ctx) => {
      await ctx.answerCbQuery();  // Responder al callback query
      return walletCommand(ctx);  // Llamar a la función de la wallet
    });

    bot.action('balance', async (ctx) => {
      await ctx.answerCbQuery();  // Responder al callback query
      return balanceCommand(ctx);  // Llamar a la función de balance
    });

    bot.action(/^wallet_balance_/, handleWalletBalance);

    // Aquí están los manejadores para los botones de callback del menú
    bot.action('transfer', async (ctx) => {
      await ctx.answerCbQuery();  // Responder al callback query
      return transferCommand(ctx);  // Llamar a la función de la transfer
    });
    bot.action(/^transfer_wallet_.+$/, handleWalletSelection);
    bot.on('text', (ctx) => {
      if (!ctx.session.fromWallet) return;
      if (!ctx.session.toAddress) return handleToAddress(ctx);
      if (!ctx.session.amount) return handleAmount(ctx);
    });

    // Comando /wallet
    bot.command("wallet", walletCommand);

    // Manejador para la creación de una nueva wallet
    bot.action('new_wallet', createNewWallet);

    // Manejador de texto cuando se espera un nombre de wallet
    bot.on('text', handleWalletName);

    bot.command('balance', balanceCommand);

    bot.command('swap', async (ctx) => {
      const walletResult = await fetchWallet(ctx.chat.id);
      const address = walletResult.success ? walletResult.wallet_address : null;

      const fromToken = 'TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR'; // WTRX
      const toToken = 'TXL6rJbvmjD46zeN1JssfgxvSo99qC8MRT';   // SUN
      const amount = '10';

      await swapTokens(ctx, fromToken, toToken, amount, address);
    });

    // bot.command('transfer', async (ctx) => {
    //   const args = ctx.message.text.split(' ');
    //   if (args.length !== 3) {
    //     return ctx.reply('Usage: /transfer <toAddress> <amount>');
    //   }
    //   const toAddress = args[1];
    //   const amount = parseFloat(args[2]);
    //   if (isNaN(amount) || amount <= 0) {
    //     return ctx.reply('Please provide a valid positive number for the amount.');
    //   }
    //   await transferTRX(ctx, toAddress, amount);
    // });

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