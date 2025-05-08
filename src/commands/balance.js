const { tronWeb } = require('../utils/tron');
const { fetchAllWallets } = require("../service/user.service");
const { Markup } = require('telegraf');
const axios = require('axios');
const { clearAllSessionFlows } = require('./clearSessions');



// ABI para interactuar con contratos de pares
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

// ABI para interactuar con contratos de tokens
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

// Obtener precio del token en TRX usando el contrato del par
async function getTokenPriceInTRX(tokenAddress) {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    const response = await axios.get(url);
    const pair = response.data.pairs?.[0];

    if (!pair) return null;

    
    const pairAddress = pair.pairAddress;
    // Interactuar con el contrato del par usando TronWeb
    const pairContract = await tronWeb.contract(tokenPairABI, pairAddress);
    const token0Address = await pairContract.token0().call();
    const token1Address = await pairContract.token1().call();

    const token0Contract = await tronWeb.contract(tokenABI, token0Address);
    const token1Contract = await tronWeb.contract(tokenABI, token1Address);

    const token0Decimals = await token0Contract.decimals().call();
    const token1Decimals = await token1Contract.decimals().call();

    
    // Obtener las reservas del par
    const reserves = await pairContract.getReserves().call();
    const reserve0 = BigInt(reserves[0].toString()) / (10n ** BigInt(token0Decimals));
    const reserve1 = BigInt(reserves[1].toString()) / (10n ** BigInt(token1Decimals));



    const price = tokenAddress === token0Address
  ? Number(reserve1) / Number(reserve0)
  : Number(reserve0) / Number(reserve1);



    return price;
  } catch (err) {
    console.error('Error getting price from DexScreener:', err.message);
    return null;
  }

}

// Función para escapar texto para MarkdownV2
function escapeMarkdown(text) {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

// Función para obtener el balance de TRC20 tokens
async function getTRC20Balance(address) {
  try {
    const fetch = (...args) =>
      import('node-fetch').then(({ default: fetch }) => fetch(...args));

    const response = await fetch(`https://apilist.tronscanapi.com/api/account/wallet?address=${address}&asset_type=1`);
    const data = await response.json();

    const assets = data.data;

    if (!data || !data.data || data.data.length === 0) {
      return `No tokens found for address: ${escapeMarkdown(address)}`;
    }

    const tronScanLink = `[🔗 View on Tronscan](https://tronscan.org/#/address/${escapeMarkdown(address)})`;

    let balanceReport = `💼 *Wallet Address:*\n\`${escapeMarkdown(address)}\`\n${tronScanLink}\n\n━━━━━━━━━━━━━━━━━━━━━━━`;

    // Sleep entre peticiones (para DexScreener)
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    for (const asset of assets) {
      const tokenName = escapeMarkdown(asset.token_name || "");
      const tokenSymbol = escapeMarkdown(asset.token_abbr || "");
      const roundedBalance = parseFloat(asset.balance).toFixed(6);
      const roundedValueInUSD = parseFloat(asset.token_value_in_usd).toFixed(2);
      let valueInTRXFormatted = "";

      if (tokenName.toLowerCase() !== "trx") {
        await sleep(300);
        const tokenPriceInTRX = await getTokenPriceInTRX(asset.token_id);
        const valueInTRX = parseFloat(asset.balance) * Number(tokenPriceInTRX);
        valueInTRXFormatted = valueInTRX.toFixed(6);
      }

      balanceReport += `\n\n🪙 *Token:* ${tokenName} (${tokenSymbol})` +
                       `\n• Balance: *${roundedBalance}*` +
                       `\n• 💵 USD Value: *$${roundedValueInUSD}*` +
                       // linea para mostrar el equivalente en trx (valueInTRXFormatted ? `\n• 🔄 In TRX: *${valueInTRXFormatted}*` : ``) +
                       `\n━━━━━━━━━━━━━━━━━━━━━━━`;
    }

    return balanceReport;

  } catch (error) {
    console.error("Error fetching TRC20 balance:", error);
    return "⚠️ Sorry, an error occurred while fetching your TRC20 balance.";
  }
}


async function balanceCommand(ctx) {

  try {
    clearAllSessionFlows(ctx);
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
