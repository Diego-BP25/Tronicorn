const { tronWeb } = require('../utils/tron');
const { fetchAllWallets } = require("../service/user.service");
const { Markup } = require('telegraf');
const axios = require('axios');

const tokenPairABI = [
  {
    "constant": true,
    "inputs": [],
    "name": "getReserves",
    "outputs": [
      { "name": "reserve0", "type": "uint112" },
      { "name": "reserve1", "type": "uint112" },
      { "name": "blockTimestampLast", "type": "uint32" }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }
];

const tokenABI = [
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }
];

async function findPairOnDexScreener(tokenAddress) {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    const response = await axios.get(url);
    const pairs = response.data.pairs;
    return pairs.length > 0 ? pairs[0].pairAddress : null;
  } catch (error) {
    console.error('Error fetching pair from DexScreener:', error);
    return null;
  }
}

async function getTokenDecimals(tokenAddress) {
  try {
    const tokenContract = await tronWeb.contract(tokenABI, tokenAddress);
    return await tokenContract.decimals().call();
  } catch (error) {
    console.error("Error fetching token decimals:", error);
    return 6; // Default to 6 if unknown
  }
}

async function getTokenPriceInTRX(tokenAddress) {
  try {
    const pairAddress = await findPairOnDexScreener(tokenAddress);
    if (!pairAddress) return null;

    const pairContract = await tronWeb.contract(tokenPairABI, pairAddress);
    const reserves = await pairContract.getReserves().call();
    if (Number(reserves.reserve0) === 0 || Number(reserves.reserve1) === 0) {
      return null;
    }

    return Number(reserves.reserve1) / Number(reserves.reserve0);
  } catch (error) {
    console.error("Error fetching token price in TRX:", error);
    return null;
  }
}

async function getTRC20Balance(address) {
  try {
    const fetch = (...args) =>
      import('node-fetch').then(({ default: fetch }) => fetch(...args));

    const response = await fetch(`https://apilist.tronscanapi.com/api/account/wallet?address=${address}&asset_type=1`);
    const data = await response.json();
    const assets = data.data;

    if (!data || !data.data || data.data.length === 0) {
      return `No tokens found for address: ${address}`;
    }

    const tronScanLink = `[🌍 View on Tronscan](https://tronscan.org/#/address/${address})`;
    let balanceReport = `💼 *Wallet Address* • \n${address}\n${tronScanLink}`;

    for (const asset of assets) {
      const decimals = await getTokenDecimals(asset.token_address);
      const adjustedBalance = parseFloat(asset.balance) / (10 ** decimals);
      const roundedBalance = adjustedBalance.toFixed(6);
      const tokenSymbol = asset.token_abbr || "";
      const tokenName = asset.token_name;
      const roundedValueInUSD = parseFloat(asset.token_value_in_usd || 0).toFixed(6);
      let valueInTRX = "0.000000";

      if (tokenName.toLowerCase() === "trx") {
        valueInTRX = roundedBalance;
      } else {
        const tokenPriceInTRX = await getTokenPriceInTRX(asset.token_address);
        valueInTRX = tokenPriceInTRX ? (adjustedBalance * tokenPriceInTRX).toFixed(6) : "0.000000";
      }

      balanceReport += `\n\n──────────────────────────────\n\nToken: ${tokenName} (${tokenSymbol})\n\n balance: ${roundedBalance}\n\n current value in USD : ${roundedValueInUSD}\n\n Equivalent in TRX: ${valueInTRX}`;
    }

    return balanceReport;
  } catch (error) {
    console.error("Error fetching TRC20 balance:", error);
    return "Sorry, an error occurred while fetching your TRC20 balance.";
  }
}

async function balanceCommand(ctx) {
  try {
    const userId = ctx.chat.id;
    const walletResult = await fetchAllWallets(userId);

    if (walletResult.success && walletResult.wallets.length > 0) {
      const walletButtons = walletResult.wallets.map(wallet => {
        return [Markup.button.callback(wallet.wallet_name, `wallet_balance_${wallet.wallet_address}`)];
      });

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

async function handleWalletBalance(ctx) {
  const callbackData = ctx.update.callback_query.data;
  const walletAddress = callbackData.replace('wallet_balance_', '');

  try {
    const trc20Balance = await getTRC20Balance(walletAddress);
    await ctx.editMessageText(`${trc20Balance}`, { parse_mode: "Markdown", disable_web_page_preview: true });
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    await ctx.reply("Sorry, an error occurred while fetching the balance for this wallet.");
  }
}

module.exports = {
  balanceCommand,
  handleWalletBalance,
};