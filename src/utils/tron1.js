const TronWeb = require('tronweb').TronWeb;
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();

// TronWeb initialization
const tronWeb = new TronWeb({
  fullHost: process.env.TRON_FULL_HOST || "https://api.trongrid.io/",
  headers: { "TRON-PRO-API-KEY": process.env.API_KEY },
  privateKey: process.env.PRIVATE_KEY,
});

// Ensure TronWeb is ready
async function ensureTronWebReady() {
  try {
    const isConnected = await tronWeb.isConnected();
    if (!isConnected.fullNode || !isConnected.solidityNode || !isConnected.eventServer) {
      throw new Error("❌ TronWeb not fully connected");
    }
    // Optional: log success (for debug)
    // console.log("✅ TronWeb is connected and ready");
  } catch (err) {
    console.error("TronWeb connection error:", err.message);
    throw err;
  }
}

// Encryption function
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
    iv
  );
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Decryption function
function decrypt(text) {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
    iv
  );
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Export all
module.exports = {
  tronWeb,
  ensureTronWebReady,
  encrypt,
  decrypt,
};