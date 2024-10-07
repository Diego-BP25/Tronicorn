// Función para manejar el texto cuando se espera un nombre de wallet
async function handleWalletName(ctx) {
  if (ctx.session.waitingForWalletName) {
    const walletName = ctx.message.text;
    console.log(`Nombre de wallet recibido: ${walletName}`);

    try {
      // Generar la cuenta TRON (dirección y clave privada)
      const account = await tronWeb.createAccount();

      // Validar que se ha creado correctamente la cuenta
      if (!account || !account.address || !account.address.base58 || !account.privateKey) {
        throw new Error("Failed to generate a valid wallet account.");
      }

      const walletAddress = account.address.base58;  // Dirección pública generada
      const pkey = account.privateKey;
      const encryptedPrivateKey = encrypt(account.privateKey);  // Clave privada cifrada

      // LOG adicional para asegurarnos de que la wallet se generó correctamente
      console.log(`Wallet generada para el usuario ${ctx.chat.id} con dirección: ${walletAddress}`);

      // Asegurarse de que walletAddress no es nulo
      if (!walletAddress) {
        throw new Error("Wallet address is null. Cannot proceed.");
      }

      // Insert the log statement before saving the wallet to the database
      console.log(`Valor de walletAddress antes de guardar: ${walletAddress}`);

      ctx.session.waitingForWalletName = false;  // Reseteamos el estado

      // Guardar la nueva wallet
      const saveResult = await saveWallet({
        id: ctx.chat.id,
        wallet_name: walletName,
        wallet_address: walletAddress,
        encryptedPrivateKey: encryptedPrivateKey
      });

      if (saveResult.success) {
        await ctx.reply(`Your wallet "${walletName}" has been successfully registered.`);
        await ctx.reply(`
          Your wallet has been created
          User id: ${ctx.chat.id}
          Your new TRON address is: ${walletAddress}
          Your encrypted private key is: ${encryptedPrivateKey}

          Make sure to securely store your private key.
          Private Key: ${pkey}
        `);
      } else {
        await ctx.reply(`Error: ${saveResult.message}`);
      }
    } catch (error) {
      console.error("Error generating wallet or saving to database:", error);
      await ctx.reply("An error occurred while creating your wallet.");
    }
  }
}
