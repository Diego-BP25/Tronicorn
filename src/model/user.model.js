const mongoose = require('mongoose')
const Schema = mongoose.Schema

const walletSchema = new Schema({
    wallet_address: {
        type: String,
        required: true,
        unique: true,
        sparse: true
    },
    encryptedPrivateKey: {
        type: String,
        required: true,
    },
    wallet_name: {
        type: String, // Se añade un campo para el nombre de la wallet
        required: true,
    }
});

const userSchema = new Schema({
    userId: {
        type: String,
        unique: true,
    },
    wallets: [walletSchema] // Un usuario ahora puede tener múltiples wallets
});

const user = mongoose.model('user', userSchema);
module.exports = user;
