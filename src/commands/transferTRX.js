const { fetchAllWallets, fetch_Private_key } = require('../service/user.service');
const { decrypt, tronWeb } = require('../utils/tron');
const { Markup } = require('telegraf');
// ✅ Centralized error messages (for easy updates)
const ERROR_MESSAGES = {
  WALLET_LOAD_FAILED: "❌ Failed to load your wallets. Please try again later.",
  NO_WALLETS: "⚠️ You have no registered wallets. Create one first.",
  INVALID_TRON_ADDRESS: "🔍 Invalid TRON address. Please check and re-enter.",
  INVALID_AMOUNT: "💸 Amount must be a number ≥ 1 TRX.",
  PRIVATE_KEY_FAIL: "🔐 Failed to access this wallet's private key.",
  ADDRESS_MISMATCH: "🚨 Private key does not match the selected wallet.",
  TRANSACTION_FAILED: "⚡ Transaction failed. Reason:",
  INSUFFICIENT_BALANCE: "🔴 Insufficient balance", // Added new error type
  GENERIC_ERROR: "❌ Something went wrong. Please retry.",
};

// --- CORE FUNCTIONS ---

// Initiate transfer (UNCHANGED)
async function transferCommand(ctx) {
  try {
    const walletResult = await fetchAllWallets(ctx.chat.id);

    if (walletResult.success && walletResult.wallets.length > 0) {
      const walletButtons = walletResult.wallets.map(wallet => [
        Markup.button.callback(wallet.wallet_name, `transfer_wallet_${wallet.wallet_address}`)
      ]);
      walletButtons.push([Markup.button.callback('❌ Close', 'close')]);

      ctx.session.transferState = 'waitingForWallet';
      await ctx.reply('Select a wallet to transfer from:', Markup.inlineKeyboard(walletButtons));
    } else {
      await ctx.reply(ERROR_MESSAGES.NO_WALLETS);
    }
  } catch (error) {
    console.error("[ERROR] fetchAllWallets failed:", error);
    await ctx.reply(ERROR_MESSAGES.WALLET_LOAD_FAILED);
  }
}

// Handle wallet selection (UNCHANGED)
async function handleWalletSelection(ctx) {
  try {
    const callbackData = ctx.update.callback_query.data;
    const walletAddress = callbackData.replace('transfer_wallet_', '');

    ctx.session.fromWallet = walletAddress;
    ctx.session.transferState = 'waitingForToAddress';
    await ctx.reply('Enter the recipient\'s TRON address:');
      } catch (error) {
    console.error("[ERROR] Wallet selection failed:", error);
    await ctx.reply(ERROR_MESSAGES.GENERIC_ERROR);
  }
}

// Validate recipient address (UNCHANGED)
async function handleToAddress(ctx) {
  const address = ctx.message.text.trim();

  if (!tronWeb.isAddress(address)) {
    console.error("[ERROR] Invalid TRON address:", address);
    return ctx.reply(ERROR_MESSAGES.INVALID_TRON_ADDRESS);
  }

  ctx.session.toAddress = address;
  ctx.session.transferState = 'waitingForAmount';
  await ctx.reply('Enter the TRX amount to send:');
}

// Validate amount (UNCHANGED)
async function handleAmount(ctx) {
  const amount = parseFloat(ctx.message.text);

  if (isNaN(amount) || amount < 1) {
    console.error("[ERROR] Invalid amount:", ctx.message.text);
    return ctx.reply(ERROR_MESSAGES.INVALID_AMOUNT);
  }

  ctx.session.amount = amount;
  await transferTRX(ctx, ctx.session.fromWallet, ctx.session.toAddress, ctx.session.amount);
}

// Execute TRX transfer (UPDATED VERSION)
async function transferTRX(ctx, fromAddress, toAddress, amount) {
  try {
    // Fetch & decrypt private key
    const privateKeyResult = await fetch_Private_key(ctx.chat.id, fromAddress);
    if (!privateKeyResult.success) {
      throw new Error(ERROR_MESSAGES.PRIVATE_KEY_FAIL);
    }

    const decryptedPrivateKey = decrypt(privateKeyResult.encryptedPrivateKey);
    const addressFromPrivateKey = tronWeb.address.fromPrivateKey(decryptedPrivateKey);

    if (addressFromPrivateKey !== fromAddress) {
      throw new Error(ERROR_MESSAGES.ADDRESS_MISMATCH);
    }

    // Get current balance (NEW CHECK)
    const balance = await tronWeb.trx.getBalance(fromAddress);
    const balanceTRX = tronWeb.fromSun(balance);
    
    if (amount > balanceTRX) {
      throw new Error(`${ERROR_MESSAGES.INSUFFICIENT_BALANCE}\nAttempted: ${amount} TRX\nAvailable: ${balanceTRX} TRX`);
    }

    // Send transaction
    const amountInSun = tronWeb.toSun(amount);
    const tradeobj = await tronWeb.transactionBuilder.sendTrx(toAddress, amountInSun, fromAddress);
    const signedtxn = await tronWeb.trx.sign(tradeobj, decryptedPrivateKey);
    const receipt = await tronWeb.trx.sendRawTransaction(signedtxn);

    if (receipt.result) {
      const tronScanTxLink = `https://tronscan.org/#/transaction/${receipt.txid}`;
      
      function escapeMarkdownV2(text) {
        return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
      }
      
      await ctx.reply(
        `✅ Sent ${escapeMarkdownV2(amount.toString())} TRX to ${escapeMarkdownV2(toAddress)}\n\n` +
        `📌 Txn Hash: ${escapeMarkdownV2(receipt.txid)}\n` +
        `[🔗 View on Tronscan](${escapeMarkdownV2(tronScanTxLink)})`,
        { parse_mode: "MarkdownV2", disable_web_page_preview: true }
      );
    } else {
      throw new Error("Network rejected the transaction.");
    }
  } catch (error) {
    console.error("[ERROR] transferTRX failed:", error);
    
    // Special handling for insufficient balance (NEW)
    if (error.message.includes(ERROR_MESSAGES.INSUFFICIENT_BALANCE)) {
      await ctx.reply(error.message); // Show pre-formatted balance error
    } 
    // Default error handler
    else {
      await ctx.reply(`${ERROR_MESSAGES.TRANSACTION_FAILED} ${error.message}`);
    }
  } finally {
    // Clear session
    ctx.session.transferState = null;
    ctx.session.fromWallet = null;
    ctx.session.toAddress = null;
    ctx.session.amount = null;
  }
}

module.exports = {
  transferCommand,
  handleWalletSelection,
  handleToAddress,
  handleAmount,
};