const { tronWeb, ensureTronWebReady } = require('../utils/tron1');
const { fetchAllWallets } = require("../service/user.service");
const { Markup } = require('telegraf');
const axios = require('axios');

// ==================== CONFIGURATION ====================
const TRX_CONTRACT_ADDRESS = 'TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR'; // USDT contract on Tron
const MIN_LIQUIDITY_USD = 1000; // $1,000 minimum liquidity

// ==================== ABI DEFINITIONS ====================
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
  },
  {
    "constant": true,
    "inputs": [],
    "name": "token0",
    "outputs": [{ "name": "", "type": "address" }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "token1",
    "outputs": [{ "name": "", "type": "address" }],
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
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "name": "", "type": "string" }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }
];

// ==================== HELPERS ====================
async function withRetry(fn, retries = 3, delay = 1000) {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 1) throw error;
    await new Promise(res => setTimeout(res, delay));
    return withRetry(fn, retries - 1, delay);
  }
}

async function findPairOnDexScreener(tokenAddress) {
  try {
    const response = await withRetry(() =>
      axios.get(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`, {
        timeout: 5000
      })
    );

    const validPairs = response.data.pairs;

        const trxPair = validPairs.find(p =>
      [p.baseToken.address, p.quoteToken.address].includes(TRX_CONTRACT_ADDRESS)
    );

    const finalPair = trxPair || validPairs[0];
    if (!finalPair) {
      console.error(`❌ No suitable pairs for ${tokenAddress}`);
      return null;
    }

    console.log(`✅ Selected pair: ${finalPair.baseToken.symbol}/${finalPair.quoteToken.symbol}`);
    return finalPair.pairAddress;
  } catch (error) {
    console.error('DexScreener error:', error.message);
    return null;
  }
}

const { tronWeb, ensureTronWebReady } = require('../utils/tron');

async function getTokenDecimals(tokenAddress) {
  try {
    await ensureTronWebReady(); // ← added
    if (!tokenAddress) throw new Error("Missing token address");

    const tokenContract = await tronWeb.contract(tokenABI, tokenAddress);
    const decimals = await tokenContract.decimals().call();
    return parseInt(decimals);
  } catch (error) {
    console.error(`Decimals error for ${tokenAddress}:`, error.message);
    return 6; // default fallback
  }
}

async function getTokenPriceInTRX(tokenAddress) {
    try {
      await ensureTronWebReady(); // ← added
  
      const pairAddress = await findPairOnDexScreener(tokenAddress);
      if (!pairAddress) return null;
  
      const pairContract = await tronWeb.contract(tokenPairABI, pairAddress);
      const [token0Address, token1Address] = await Promise.all([
        pairContract.token0().call(),
        pairContract.token1().call()
      ]);
  
      const [token0Decimals, token1Decimals] = await Promise.all([
        getTokenDecimals(token0Address),
        getTokenDecimals(token1Address)
      ]);
  
      const reserves = await pairContract.getReserves().call();
      const r0 = Number(reserves.reserve0) / (10 ** token0Decimals);
      const r1 = Number(reserves.reserve1) / (10 ** token1Decimals);
  
      if (r0 === 0 || r1 === 0) {
        throw new Error("Zero liquidity");
      }
  
      const price =
        token0Address === TRX_CONTRACT_ADDRESS
          ? r0 / r1
          : token1Address === TRX_CONTRACT_ADDRESS
          ? r1 / r0
          : null;
  
      return price;
    } catch (error) {
      console.error("Price calculation failed:", error.message);
      return null;
    }
  }
    
// ==================== BALANCE FETCHING ====================
async function getTRC20Balance(address) {
    try {
      await ensureTronWebReady(); // ← added
  
      const fetch = (...args) =>
        import('node-fetch').then(({ default: fetch }) => fetch(...args));
  
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
  
      const response = await fetch(
        `https://apilist.tronscanapi.com/api/account/wallet?address=${address}&asset_type=1`,
        { signal: controller.signal }
      );
  
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`Tronscan API: ${response.status}`);
      const { data: assets } = await response.json();
  
      if (!assets?.length) return `No tokens found for ${address}`;
  
      let report = `💼 *Wallet Address*\n${address}\n[🌍 Tronscan](https://tronscan.org/#/address/${address})`;
  
      for (const asset of assets) {
        if (!asset.token_address) continue;
  
        const decimals = await getTokenDecimals(asset.token_address);
        const balance = (asset.balance / (10 ** decimals)).toFixed(6);
        const usdValue = parseFloat(asset.token_value_in_usd || 0).toFixed(6);
  
        let trxValue = "N/A";
        if (asset.token_name.toLowerCase() === 'trx') {
          trxValue = balance;
        } else {
          const price = await getTokenPriceInTRX(asset.token_address);
          trxValue = price ? (price * parseFloat(balance)).toFixed(6) : "N/A";
        }
  
        report += `\n\n────────────────\nToken: ${asset.token_name || "Unknown"} (${asset.token_abbr || "?"})\nBalance: ${balance}\nUSD Value: ${usdValue}\nTRX Value: ${trxValue}`;
      }
  
      return report;
    } catch (error) {
      console.error("Balance fetch failed:", error.message);
      return "Error fetching balance. Please try again later.";
    }
  }
  
// ==================== TELEGRAM HANDLERS ====================
async function balanceCommand(ctx) {
  try {
    const userId = ctx.chat.id;
    const walletResult = await fetchAllWallets(userId);

    if (walletResult.success && walletResult.wallets.length > 0) {
      const walletButtons = walletResult.wallets.map(wallet => [
        Markup.button.callback(wallet.wallet_name, `wallet_balance_${wallet.wallet_address}`)
      ]);

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
    await ctx.editMessageText(trc20Balance, {
      parse_mode: "Markdown",
      disable_web_page_preview: true
    });
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    await ctx.reply("Sorry, an error occurred while fetching the balance for this wallet.");
  }
}

module.exports = {
  balanceCommand,
  handleWalletBalance
};