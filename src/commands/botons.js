// Función para manejar el botón "Close"
async function handleClose(ctx) {
    await ctx.answerCbQuery();  // Responder el callback
    await ctx.deleteMessage();  // Eliminar el mensaje actual
  }

module.exports = {
    handleClose
}