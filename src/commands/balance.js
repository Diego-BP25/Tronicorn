const { tronWeb } = require('../utils/tron');
const { fetchAllWallets } = require("../service/user.service");
const { Markup } = require('telegraf');
const axios = require('axios');

// Función para obtener el balance de TRC20 tokens
async function getTRC20Balance(address) {
  try {
    const fetch = (...args) =>
      import('node-fetch').then(({ default: fetch }) => fetch(...args));
  
  // Obtener los activos de la billetera usando la API adecuada
  const response = await fetch(`https://apilist.tronscanapi.com/api/account/wallet?address=${address}&asset_type=1`)


  const data = await response.json();

  const assets = data.data;

    if (!data || !data.data || data.data.length === 0) {
      return `No tokens found for address: ${address}`;
    }

    let balanceReport = `💼 Wallet Address: ${address}:`;

    for (const asset of assets)  {
      const roundedBalance = parseFloat(asset.balance).toFixed(6);
      const roundedValueInUSD = parseFloat(asset.token_value_in_usd).toFixed(6);
      balanceReport += `\n\n------------------------------------------------------\n\nToken: ${asset.token_name}\n\n balance: ${roundedBalance}\n\n current value in USD : ${roundedValueInUSD}`;
    };

    return balanceReport;
  } catch (error) {
    console.error("Error fetching TRC20 balance:", error);
    return "Sorry, an error occurred while fetching your TRC20 balance.";
  }
}

async function balanceCommand(ctx) {
  try {
    const userId = ctx.chat.id;

    // Obtener todas las wallets del usuario
    const walletResult = await fetchAllWallets(userId);

    if (walletResult.success && walletResult.wallets.length > 0) {
      // Listar las wallets del usuario como botones
      const walletButtons = walletResult.wallets.map(wallet => {
        return [Markup.button.callback(wallet.wallet_name, `wallet_balance_${wallet.wallet_address}`)];
      });

      // Agregar botón de "Close" al final
      walletButtons.push([Markup.button.callback('❌ Close', 'close')]);

      await ctx.reply(
        'Please select a wallet to view its balance:',
        Markup.inlineKeyboard(walletButtons)
      );
    } else {
      await ctx.reply("You don't have any registered wallets. Please create one first.");
    }
  } catch (error) {
    console.error("Error fetching wallets:", error);
    ctx.reply("Sorry, an error occurred while fetching your wallets.");
  }
}


// Manejador para obtener el balance de la wallet seleccionada
async function handleWalletBalance(ctx) {
  const callbackData = ctx.update.callback_query.data;

  // Extraer la dirección de la wallet del callback_data
  const walletAddress = callbackData.replace('wallet_balance_', '');

  try {
    // Obtener el balance de los tokens TRC20
    const trc20Balance = await getTRC20Balance(walletAddress);

    // Responder con la información de balance + botón de cerrar
    await ctx.reply(
      `${trc20Balance}`,
      Markup.inlineKeyboard([
        [Markup.button.callback('❌ Close', 'close')]
      ])
    );
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    await ctx.reply("Sorry, an error occurred while fetching the balance for this wallet.");
  }
}

module.exports = {
  balanceCommand,
  handleWalletBalance,
};
