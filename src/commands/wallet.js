const { tronWeb, encrypt } = require('../utils/tron');
const { saveUser, fetchWallet, UpdateUser } = require("../service/user.service");

module.exports = async function walletCommand(ctx) {
  try {
    // Comprobamos si el usuario ya tiene wallets
    const userWallets = await fetchWallet(ctx.chat.id);
    
    if (userWallets.success && userWallets.wallets.length > 0) {
      // Si ya tiene wallets, listamos las existentes
      let walletList = 'Here are your current wallets:\n\n';
      userWallets.wallets.forEach((wallet, index) => {
        walletList += `${index + 1}. ${wallet.wallet_name}: ${wallet.wallet_address}\n`;
      });
      
      await ctx.reply(walletList, 
        Markup.inlineKeyboard([
          [Markup.button.callback('➕ Create New Wallet', 'new_wallet')]
        ]));
    } else {
      // Si no tiene wallets, pedimos el nombre de la nueva wallet
      await ctx.reply('Please enter a name for your new wallet:');
      ctx.session.awaitingWalletName = true; // Usamos una sesión para seguir esperando el nombre
    }

  } catch (error) {
    console.error("Error fetching or creating wallets:", error);
    ctx.reply("Sorry, an error occurred while fetching or creating your wallet.");
  }
};
