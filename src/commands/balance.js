const { tronWeb } = require('../utils/tron');
const { fetchAllWallets } = require("../service/user.service");
const { Markup } = require('telegraf');
const axios = require('axios');

// Función para obtener el balance de TRC20 tokens
async function getTRC20Balance(address) {
  try {
    const response = await axios.get('https://apilist.tronscanapi.com/api/account/tokens', {
      params: {
        address: address,
        start: 0,
        limit: 200,
        hidden: 0,
        show: 0,
        sortBy: 2,
        sortType: 0,
      }
    });

    const data = response.data;

    if (!data || !data.data || data.data.length === 0) {
      return `No tokens found for address: ${address}`;
    }

    let balanceReport = `Your token balances for ${address}:\n\n`;

    data.data.forEach(token => {
      balanceReport += `${token.tokenName} (${token.tokenAbbr}): ${token.balance / Math.pow(10, token.tokenDecimal)} usd current value is ${token.tokenPriceInUsd}\n`;
    });

    return balanceReport;
  } catch (error) {
    console.error("Error fetching TRC20 balance:", error);
    return "Sorry, an error occurred while fetching your TRC20 balance.";
  }
}

// Comando balance modificado
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

      await ctx.reply('Please select a wallet to view its balance:', Markup.inlineKeyboard(walletButtons));
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
    // Obtener el balance en TRX de la wallet
    const balance = await tronWeb.trx.getBalance(walletAddress);
    const formattedBalance = tronWeb.fromSun(balance);  // Convertir de Sun a TRX

    // Obtener el balance de los tokens TRC20
    const trc20Balance = await getTRC20Balance(walletAddress);

    // Responder con la información de balance
    await ctx.reply(`💼 Wallet Address: ${walletAddress}\n\nTRX Balance: ${formattedBalance} TRX\n\n${trc20Balance}`);
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    await ctx.reply("Sorry, an error occurred while fetching the balance for this wallet.");
  }
}

module.exports = {
  balanceCommand,
  handleWalletBalance,
};
