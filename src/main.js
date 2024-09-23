const express = require('express');
const { Telegraf } = require('telegraf');
const { getUserAddress } = require('./utils/database');
const { walletCommand, balanceCommand, swapTokens, transferTRX } = require('./commands');
const { fetchWallet } = require('../src/service/user.service');
const databaseConnect = require('./utils/database');

const botToken = process.env.BOT_TOKEN;
const bot = new Telegraf(botToken);
const app = express();
const PORT = process.env.PORT || 3030;

(async () => {
  try {
    await databaseConnect();
    console.log('Database connected successfully');

    // Comandos del bot
    // bot.start(startCommand);

    bot.command("wallet", walletCommand);

    bot.command('balance', balanceCommand);

    bot.command('swap', async (ctx) => {
      console.log('swap command called');
      console.log('Connecting to the db and getting the user wallet');

      const walletResult = await fetchWallet(ctx.chat.id);
      const address = walletResult.success ? walletResult.wallet_address : null;

      console.log(`Recipient address is ${address}`);

      const fromToken = 'TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR'; // WTRX
      const toToken = 'TXL6rJbvmjD46zeN1JssfgxvSo99qC8MRT';   // SUN
      const amount = '10';

      swapTokens(ctx, fromToken, toToken, amount, address);
    });

    bot.command('transfer', async (ctx) => {
      const args = ctx.message.text.split(' ');
      if (args.length !== 3) {
        return ctx.reply('Usage: /transfer <toAddress> <amount>');
      }
      const toAddress = args[1];
      const amount = parseFloat(args[2]);
      if (isNaN(amount) || amount <= 0) {
        return ctx.reply('Please provide a valid positive number for the amount.');
      }
      await transferTRX(ctx, toAddress, amount);
    });

    // Configura el webhook para recibir actualizaciones
    bot.telegram.setWebhook(`https://tronbot-1eu6.onrender.com/bot${botToken}`);

    // Usamos Express para manejar las peticiones HTTP para el webhook
    app.use(bot.webhookCallback(`/bot${botToken}`));

    // Servidor Express para escuchar en el puerto 3000 o el puerto configurado
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    console.log('Bot is running with webhook...');

  } catch (error) {
    console.error('Failed to connect to the database:', error);
    process.exit(1);
  }
})();
