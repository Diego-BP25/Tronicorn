function clearAllSessionFlows(ctx) {
    ctx.session.transferState = null;
    ctx.session.fromWallet = null;
    ctx.session.toAddress = null;
    ctx.session.amount = null;
    ctx.session.awaitingTokenSwap = false;
    ctx.session.tokenAddress = null;
  }
  
  module.exports = {
    clearAllSessionFlows
  };