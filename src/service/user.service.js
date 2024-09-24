const user = require("../model/user.model");
const { USER } = require("../config/config.constant");

class userServices {
    // Guardar un usuario en la base de datos
    async saveUser(data) {
        try {
            const { id, wallet_address, encryptedPrivateKey } = data;

            const new_user = await user.create({
                userId: id,
                wallet_address: wallet_address,
                encryptedPrivateKey: encryptedPrivateKey
            });

            if (new_user) {
                return {
                    message: USER.WALLET_SAVED,
                    success: true,
                    data: new_user
                };
            } else {
                return {
                    message: USER.WALLET_NOT_SAVED,
                    success: false,
                };
            }
        } catch (error) {
            return {
                message: USER.ERROR + error.message,
                success: false,
            };
        }
    }

    // Recuperar las wallets de un usuario
    async fetchWallet(id) {
        try {
            const getUser = await user.findOne({ userId: id });
            if (getUser) {
                return {
                    message: USER.WALLET_FETCHED,
                    success: true,
                    wallets: getUser.wallets, // Devolvemos todas las wallets del usuario
                };
            } else {
                return {
                    message: USER.WALLET_NOT_FETCHED,
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

    // Recuperar todas las wallets de un usuario (nueva función)
    async fetchAllWallets(userId) {
        try {
            const getUser = await user.findOne({ userId });
            if (getUser && getUser.wallet_address) {
                return {
                    message: USER.WALLETS_FETCHED,
                    success: true,
                    wallets: [{ wallet_address: getUser.wallet_address }] // Devolver las wallets encontradas
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
