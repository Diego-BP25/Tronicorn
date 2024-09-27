const user = require("../model/user.model");
const { USER } = require("../config/config.constant");

class userServices {
    // Guardar o añadir una wallet para un usuario
    async saveWallet(data) {
        try {
            const { id, wallet_address, encryptedPrivateKey, wallet_name } = data;


            // Validar que el wallet_address no sea null o undefined
    if (!wallet_address) {
        return {
          message: "Invalid wallet address. Cannot save wallet.",
          success: false
        };
      }

            // Buscar si el usuario ya existe
            let existingUser = await user.findOne({ userId: id });

            if (existingUser) {
                // Si el usuario ya existe, añadir una nueva wallet a la lista de wallets
                existingUser.wallets.push({
                    wallet_address: wallet_address,
                    encryptedPrivateKey: encryptedPrivateKey,
                    wallet_name: wallet_name
                });

                await existingUser.save();

                return {
                    message: USER.WALLET_SAVED,
                    success: true,
                    data: existingUser
                };
            } else {
                // Si no existe, crear un nuevo usuario con la wallet
                const newUser = await user.create({
                    userId: id,
                    wallets: [{
                        wallet_address: wallet_address,
                        encryptedPrivateKey: encryptedPrivateKey,
                        wallet_name: wallet_name
                    }]
                });

                return {
                    message: USER.WALLET_SAVED,
                    success: true,
                    data: newUser
                };
            }
        } catch (error) {
            return {
                message: USER.ERROR + error.message,
                success: false,
            };
        }
    }

    // Recuperar todas las wallets de un usuario
    async fetchAllWallets(userId) {
        try {
            const getUser = await user.findOne({ userId });
            if (getUser && getUser.wallets.length > 0) {
                return {
                    message: USER.WALLETS_FETCHED,
                    success: true,
                    wallets: getUser.wallets
                };
            } else {
                return {
                    message: USER.WALLETS_NOT_FOUND,
                    success: false,
                    wallets: []
                };
            }
        } catch (error) {
            return {
                message: USER.ERROR + error.message,
                success: false,
            };
        }
    }

    // Recuperar la clave privada cifrada de un usuario
    async fetch_Private_key(id) {
        try {
            const fetch_user = await user.findOne({ userId: id });
            if (fetch_user) {
                return {
                    message: USER.PRIVATE_KEY_FETCHED,
                    success: true,
                    encryptedPrivateKey: fetch_user.encryptedPrivateKey,
                };
            } else {
                return {
                    message: USER.PRIVATE_KEY_NOT_FETCHED,
                    success: false,
                };
            }
        } catch (error) {
            return {
                message: USER.ERROR + error,
                success: false,
            };
        }
    }

    // Actualizar información de un usuario
    async UpdateUser(id, data) {
        try {
            const fetch_user = await user.findOneAndUpdate({ userId: id }, data);
            if (fetch_user) {
                return {
                    message: USER.USER_UPDATED,
                    success: true,
                };
            } else {
                return {
                    message: USER.USER_NOT_UPDATED,
                    success: false,
                };
            }
        } catch (error) {
            return {
                message: USER.ERROR + error,
                success: false,
            };
        }
    }
}

module.exports = new userServices();
