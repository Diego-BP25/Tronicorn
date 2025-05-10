  async function replyWithPhotoFlow(ctx, photo, options) {
    const sent = await ctx.replyWithPhoto(photo, options);
    if (!ctx.session.messageFlow) ctx.session.messageFlow = [];
    ctx.session.messageFlow.push(sent.message_id);
    return sent;
  }
  
  module.exports = {
    replyWithPhotoFlow,
  };