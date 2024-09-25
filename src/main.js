const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const { startCommand, walletCommand, balanceCommand, swapTokens, transferTRX } = require('./commands');
const { fetchWallet, fetchAllWallets, saveWallet } = require('./service/user.service'); // Asegúrate de importar saveWallet
const databaseConnect = require('./utils/database');
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

    // Comando de wallet
    bot.command("wallet", async (ctx) => {
      const userId = ctx.chat.id;

      // Buscar si el usuario ya tiene wallets registradas
      const walletResult = await fetchAllWallets(userId);

      if (walletResult.success && walletResult.wallets.length > 0) {
        // Si ya tiene wallets, mostrar las wallets y botón de "Nueva Wallet"
        const walletButtons = walletResult.wallets.map(wallet => 
          Markup.button.callback(wallet.wallet_address, `wallet_${wallet.wallet_address}`)
        );
        walletButtons.push(Markup.button.callback('New Wallet', 'new_wallet'));

        await ctx.reply('Your wallets:', Markup.inlineKeyboard(walletButtons));
      } else {
        // Si no tiene wallets, solicitar que ingrese un nombre para la nueva wallet
        await ctx.reply('It looks like this is your first time. Please send the name for your new wallet:');
        ctx.session.waitingForWalletName = true;  // Marcamos que estamos esperando el nombre de la wallet
        console.log(`Esperando nombre de la wallet para el usuario ${userId}`);
      }
    });

    // Manejador de callback para botones de wallets existentes
    bot.action(/^wallet_/, async (ctx) => {
      const selectedWallet = ctx.match[0].split('_')[1];
      await ctx.answerCbQuery();
      await ctx.reply(`You selected wallet: ${selectedWallet}`);
    });

    bot.action('new_wallet', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('Please send the name for your new wallet:');
      ctx.session.waitingForWalletName = true;
      console.log('Esperando el nombre de la nueva wallet...');
    });

    // Manejador de texto cuando se espera un nombre de wallet
    bot.on('text', async (ctx) => {
      console.log('Texto recibido:', ctx.message.text);  // Depuración del texto recibido
      console.log('Estado de la sesión:', ctx.session);  // Verificar estado de la sesión

      // Verificamos si estamos esperando el nombre de la wallet
      if (ctx.session.waitingForWalletName) {
        const walletName = ctx.message.text;
        console.log(`Nombre de wallet recibido: ${walletName}`);  // Depuración

        ctx.session.waitingForWalletName = false;  // Reseteamos el estado
        console.log('Guardando wallet en la base de datos...');

        // Guardar la nueva wallet
        const saveResult = await saveWallet({ 
          id: ctx.chat.id, 
          wallet_address: walletName 
        });

        console.log("Resultado del guardado de wallet:", saveResult);

        if (saveResult.success) {
          await ctx.reply(`Your wallet "${walletName}" has been successfully registered.`);
          console.log(`Wallet ${walletName} registrada exitosamente para el usuario ${ctx.chat.id}`);
        } else {
          await ctx.reply(`Error: ${saveResult.message}`);
          console.log(`Error al registrar la wallet: ${saveResult.message}`);
        }
      } else {
        await ctx.reply('Please use the /wallet command to register a new wallet.');
        console.log('El comando /wallet no fue utilizado.');
      }
    });

    bot.command('balance', balanceCommand);

    bot.command('swap', async (ctx) => {
      const walletResult = await fetchWallet(ctx.chat.id);
      const address = walletResult.success ? walletResult.wallet_address : null;

      const fromToken = 'TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR'; // WTRX
      const toToken = 'TXL6rJbvmjD46zeN1JssfgxvSo99qC8MRT';   // SUN
      const amount = '10';

      await swapTokens(ctx, fromToken, toToken, amount, address);
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

    // Usar Express para manejar peticiones HTTP para el webhook en Render
    // Puedes comentar esto si haces pruebas locales
    bot.telegram.setWebhook(`https://tronbot-1eu6.onrender.com/bot${botToken}`);
    app.use(bot.webhookCallback(`/bot${botToken}`));

    // Iniciar servidor Express para el webhook
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    console.log('Bot is running with webhook...');

  } catch (error) {
    console.error('Failed to connect to the database:', error);
    process.exit(1);
  }
})();
