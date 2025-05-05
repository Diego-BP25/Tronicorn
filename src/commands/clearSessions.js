function clearAllSessionFlows(ctx) {
    ctx.session.transferState = null;
    ctx.session.fromWallet = null;
    ctx.session.toAddress = null;
    ctx.session.amount = null;
    ctx.session.awaitingTokenSwap = false;
    ctx.session.tokenAddress = null;
    ctx.session.sniperAmount = null;
    ctx.session.sniperState = null;
    ctx.session.sniperSlippage = null;
    ctx.session.wallet = null;
    ctx.session.awaitingExternalWallet = false;
    ctx.session.selectedWallet = null;
    ctx.session.awaitingRecipient = false;
    ctx.session.swapState = null;
    ctx.session.awaitingTrxAmount = false;
    ctx.session.swapAmount = null;
    ctx.session.awaitingSlippage = false;
    ctx.session.swapSlippage = null;
    ctx.session.swapData = {};
    ctx.session.awaitingTokenAddress = false;
    ctx.session.swapDetails = null;
    ctx.session.swapTokenState = null;
    ctx.session.awaitingTokenAmount = false;
    ctx.session.swapTokenAmount = null;
    ctx.session.awaitingSlippageToken = false;
    ctx.session.swapTokenSlippage = null;
    ctx.session.encryptedPrivateKey = null;
    ctx.session.walletAddress = null;
    ctx.session.awaitingTokenSwap = false;
    ctx.session.swapTokenFinal = null
    ctx.session.waitingForWalletName = false;
    
  }
  
  module.exports = {
    clearAllSessionFlows
  };