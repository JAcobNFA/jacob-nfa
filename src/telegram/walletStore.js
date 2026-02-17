const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const STORE_PATH = path.join(__dirname, '../../data/tg-wallets.json');
const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.warn('[WalletStore] WARNING: SESSION_SECRET not set! Using insecure default key. Set SESSION_SECRET in production!');
  }
  return crypto.createHash('sha256').update(secret || 'jacob-default-key-change-me').digest();
}

function encrypt(text) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return iv.toString('hex') + ':' + authTag + ':' + encrypted;
}

function decrypt(data) {
  const key = getEncryptionKey();
  const parts = data.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted data format');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function loadStore() {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('[WalletStore] Error loading store:', e.message);
  }
  return {};
}

function saveStore(store) {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error('[WalletStore] Error saving store:', e.message);
  }
}

function generateWallet(chatId) {
  const wallet = ethers.Wallet.createRandom();
  const store = loadStore();
  store[String(chatId)] = {
    address: wallet.address.toLowerCase(),
    encryptedKey: encrypt(wallet.privateKey),
    createdAt: Date.now()
  };
  saveStore(store);
  return { address: wallet.address, privateKey: wallet.privateKey };
}

function getStoredWallet(chatId) {
  const store = loadStore();
  const entry = store[String(chatId)];
  if (!entry) return null;
  return { address: entry.address, createdAt: entry.createdAt };
}

function exportPrivateKey(chatId) {
  const store = loadStore();
  const entry = store[String(chatId)];
  if (!entry) return null;
  try {
    const privateKey = decrypt(entry.encryptedKey);
    return { address: entry.address, privateKey };
  } catch (e) {
    console.error('[WalletStore] Decryption error:', e.message);
    return null;
  }
}

function hasGeneratedWallet(chatId) {
  const store = loadStore();
  return !!store[String(chatId)];
}

module.exports = { generateWallet, getStoredWallet, exportPrivateKey, hasGeneratedWallet };
