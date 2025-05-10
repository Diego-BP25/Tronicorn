const { tronWeb, encrypt } = require('../utils/tron');
const { fetchAllWallets, saveWallet} = require("../service/user.service");
const { Markup } = require('telegraf');
const { clearAllSessionFlows } = require('./clearSessions');


// Función para manejar el comando wallet
async function walletCommand(ctx) {
  try {
    clearAllSessionFlows(ctx);
    const userId = ctx.chat.id;

    // Buscar si el usuario ya tiene wallets registradas
    const walletResult = await fetchAllWallets(userId);

    if (walletResult.success && walletResult.wallets.length > 0) {
      // Si ya tiene wallets, las listamos en el formato solicitado
      let walletMessage = '';

      for (const wallet of walletResult.wallets) {
        const walletAddress = wallet.wallet_address;
        const walletName = wallet.wallet_name;
        const tronScanLink = `https://tronscan.org/#/address/${walletAddress}`;

        // Obtener el balance de cada wallet
        const balance = await tronWeb.trx.getBalance(walletAddress);
        const formattedBalance = tronWeb.fromSun(balance); // Formatear el balance a TRX

        walletMessage += `💼 *${walletName}*  • ${formattedBalance} TRX\n`;
        walletMessage += `\`${walletAddress}\`\n`;
        walletMessage += `[🔗 View on Tronscan](${tronScanLink})\n`;
        walletMessage += `\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;  // Separador entre wallets
      }

      // Enviar la lista de wallets junto con el botón "New Wallet"
      await ctx.replyWithMarkdown(walletMessage, {disable_web_page_preview: true, ...Markup.inlineKeyboard([
      [Markup.button.callback('💳 New Wallet', 'new_wallet')],
      [Markup.button.callback('❌ Cancel', 'cancel_flow')]
      ])
        
    });
    } else {
      // Si no tiene wallets, solicitar que ingrese un nombre para la nueva wallet
      await ctx.reply('It looks like this is your first time. Please send the name for your new wallet:');
      ctx.session.waitingForWalletName = true;  // Marcamos que estamos esperando el nombre de la wallet
    }
  } catch (error) {
    console.error("Error fetching or creating wallets:", error);
    ctx.reply("Sorry, an error occurred while fetching or creating your wallet.");
  }
}

// Función para manejar la creación de nuevas wallets
async function createNewWallet(ctx) {

  const userId = ctx.chat.id;

  const walletResult = await fetchAllWallets(userId);

  if (walletResult.success && walletResult.wallets.length >= 3){
    await ctx.editMessageText("You can't have more than 3 wallets",
      Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancel', 'cancel_flow')]
      ])
    )
  }
  else{
  try {
    await ctx.answerCbQuery();
    await ctx.editMessageText('Please type the name for your new wallet:',
      Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancel', 'cancel_flow')]
      ])
    );
    ctx.session.waitingForWalletName = true;
    
  } catch (error) {
    console.error("Error creating new wallet:", error);
  }
}
}

// Función para manejar el texto cuando se espera un nombre de wallet
async function handleWalletName(ctx) {
  if (ctx.session.waitingForWalletName) {
    const walletName = ctx.message.text;

    // Validar que el nombre solo contenga letras y números, sin espacios y tenga máximo 9 caracteres
    const validName = /^[a-zA-Z0-9]{1,9}$/.test(walletName);

    if (!validName) {
      await ctx.reply("⚠️ The wallet name must be 1-9 characters long, containing only letters and numbers, with no spaces.\n\nPlease enter a valid name:",
        Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancel', 'cancel_flow')]
        ])
      );
      return; // Volvemos a esperar otro mensaje sin salir del flujo
    }

    try {
      // Generar la cuenta TRON (dirección y clave privada)
      const account = await tronWeb.createAccount();

     // Validar que se ha creado correctamente la cuenta
if (!account || !account.address || !account.address.base58 || !account.privateKey) {
  throw new Error("Failed to generate a valid wallet account.");
}
      
      const pkey = account.privateKey;
      const walletAddress = account.address.base58;  // Dirección pública generada

      const encryptedPrivateKey = encrypt(account.privateKey);  // Clave privada cifrada

      

      ctx.session.waitingForWalletName = false;  // Reseteamos el estado

      // Guardar la nueva wallet
      const saveResult = await saveWallet({
        id: ctx.chat.id,
        wallet_name: walletName,
        wallet_address: walletAddress,
        encryptedPrivateKey: encryptedPrivateKey
      });

      if (saveResult.success) if (saveResult.success) {
        const message = `🎉 *Your wallet "${walletName}" has been successfully registered.*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `• *User ID:* ${ctx.chat.id}\n\n` +

            `• *Your new TRON address:* \`${walletAddress}\`\n\n` +

            `• *Encrypted private key:* ${encryptedPrivateKey}\n\n` +

            `• *Private Key:* ${pkey}\n\n` +
             
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` +
            `\n*WARNING*\n` +
            `Never share your private key. Store it in a secure place.\n\n` +

            `*YOU MUST DELETE THIS POST FOR SAFETY.*\n`+
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
            
        await ctx.reply(message,
           {
          parse_mode: "Markdown"},
          Markup.inlineKeyboard([
            [Markup.button.callback('❌ Close', 'cancel_flow')]
          ])
        );
      }  else {
        await ctx.reply(`Error: ${saveResult.message}`);
      }
    } catch (error) {
      console.error("Error generating wallet or saving to database:", error);
      await ctx.reply("An error occurred while creating your wallet.");
    }
  } 
};


module.exports = {
  walletCommand,
  createNewWallet,
  handleWalletName
};