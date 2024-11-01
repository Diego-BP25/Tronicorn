const { fetchAllWallets } = require("../service/user.service");
const { Markup } = require('telegraf');

// Función para manejar el comando swap
async function swapTokens(ctx) {
  try {
    const userId = ctx.chat.id;

    // Obtener todas las wallets del usuario
    const walletResult = await fetchAllWallets(userId);

    if (walletResult.success && walletResult.wallets.length > 0) {
      // Listar las wallets del usuario como botones
      const walletButtons = walletResult.wallets.map(wallet => {
        return [Markup.button.callback(wallet.wallet_name, `swap_wallet_${wallet.wallet_address}`)];
      });

      await ctx.reply('Please select a wallet to perform the swap:', Markup.inlineKeyboard(walletButtons));
    } else {
      await ctx.reply("You don't have any registered wallets. Please create one first.");
    }
  } catch (error) {
    console.error("Error fetching wallets for swap:", error);
    ctx.reply("Sorry, an error occurred while fetching your wallets.");
  }
}

// Manejador para la selección de wallet y mostrar opciones de swap
async function handleWalletSwap(ctx) {
  const Datacallback = ctx.update.callback_query.data;

  // Extraer la dirección de la wallet del callback_data
  const Addresswallet = Datacallback.replace('swap_wallet_', '');

  try {
    // Opciones de tipo de swap como botones
    const swapOptions = [
      [Markup.button.callback("TRX/Tokens", `swap_type_TRX_TOKENS_${Addresswallet}`)],
      [Markup.button.callback("Tokens/TRX", `swap_type_TOKENS_TRX_${Addresswallet}`)]
    ];

    await ctx.reply('Please select the type of swap:', Markup.inlineKeyboard(swapOptions));
  } catch (error) {
    console.error("Error handling wallet swap:", error);
    await ctx.reply("Sorry, an error occurred while setting up the swap options.");
  }
}

module.exports = {
  swapTokens,
  handleWalletSwap,
};
