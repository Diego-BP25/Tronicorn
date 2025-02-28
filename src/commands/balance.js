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

    // Obtener el precio de 1 TRX en USD desde CoinGecko
    const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tron&vs_currencies=usd');
    const priceData = await priceResponse.json();
    const trxPriceInUSD = priceData.tron.usd;
    const tronScanLink = `[🌍 View on Tronscan](https://tronscan.org/#/address/${address})`;


    let balanceReport = `💼 *Wallet Address* • \n${address}\n${tronScanLink}`;

    

    for (const asset of assets)  {
      const roundedBalance = parseFloat(asset.balance).toFixed(6);
      const roundedValueInUSD = parseFloat(asset.token_value_in_usd).toFixed(6);
      const tokenSymbol = asset.token_abbr || ""; // Símbolo del token
      const TokenName= asset.token_name
      let valueInTRX;

      if (TokenName === "trx") {
        valueInTRX = roundedBalance; // Si es TRX, el valor en TRX es el mismo balance
      } else {
        valueInTRX = (parseFloat(asset.token_value_in_usd) / trxPriceInUSD).toFixed(6);
      }      balanceReport += `\n\n─────────────────────────────────────────────\n\nToken: ${TokenName} (${tokenSymbol})\n\n balance: ${roundedBalance}\n\n current value in USD : ${roundedValueInUSD}\n\n Equivalent in TRX: ${valueInTRX}`;
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

    // Responder con la información de balance
    await ctx.reply(`${trc20Balance}`, { parse_mode: "Markdown", disable_web_page_preview: true });
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    await ctx.reply("Sorry, an error occurred while fetching the balance for this wallet.");
  }
}

module.exports = {
  balanceCommand,
  handleWalletBalance,
};