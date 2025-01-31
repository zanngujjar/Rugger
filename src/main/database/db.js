const CryptoJS = require('crypto-js');
const path = require('path');
const fs = require('fs');

class SecureDatabase {
    constructor() {
        this.dbPath = path.join(__dirname, '../../../secure-data/wallets.json');
        this.db = null;
    }

    async initialize() {
        // Ensure directory exists
        if (!fs.existsSync(path.dirname(this.dbPath))) {
            fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
        }

        // Dynamic import of lowdb
        const { Low } = await import('lowdb');
        const { JSONFile } = await import('lowdb/node');

        // Initialize database
        const adapter = new JSONFile(this.dbPath);
        this.db = new Low(adapter, { masterPassword: null, wallets: [], settings: {} });
        await this.db.read();
    }

    async hasMasterPassword() {
        await this.db.read();
        return !!this.db.data.masterPassword;
    }

    async setMasterPassword(password) {
        const salt = CryptoJS.lib.WordArray.random(128/8);
        const hashedPassword = CryptoJS.PBKDF2(password, salt, {
            keySize: 256/32,
            iterations: 10000
        }).toString();

        this.db.data.masterPassword = {
            hash: hashedPassword,
            salt: salt.toString()
        };

        await this.db.write();
    }

    async verifyPassword(password) {
        await this.db.read();
        const stored = this.db.data.masterPassword;
        if (!stored) return false;

        const hashedAttempt = CryptoJS.PBKDF2(password, 
            CryptoJS.enc.Hex.parse(stored.salt), {
            keySize: 256/32,
            iterations: 10000
        }).toString();

        return hashedAttempt === stored.hash;
    }

    encrypt(data, password) {
        return CryptoJS.AES.encrypt(JSON.stringify(data), password).toString();
    }

    decrypt(encryptedData, password) {
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedData, password);
            return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        } catch (error) {
            console.error("Decryption failed:", error);
            return null;
        }
    }

    async addWallet(name, address, privateKey, masterPassword) {
        if (!await this.verifyPassword(masterPassword)) {
            throw new Error("Invalid master password");
        }

        await this.db.read();
        const encryptedPrivateKey = this.encrypt(privateKey, masterPassword);
        
        this.db.data.wallets.push({
            id: Date.now(),
            name,
            address,
            privateKey: encryptedPrivateKey,
            createdAt: new Date().toISOString()
        });

        await this.db.write();
    }

    async getWallets() {
        await this.db.read()
        
        return this.db.data.wallets.map(wallet => ({
            id: wallet.id,
            name: wallet.name,
            address: wallet.address,
            createdAt: wallet.createdAt
        }));
    }

    async getWalletPrivateKey(id, password) {
        await this.db.read()
        
        const wallet = this.db.data.wallets.find(w => w.id === id);
        if (!wallet) return null;

        return this.decrypt(wallet.privateKey, password);
    }
}

module.exports = new SecureDatabase(); 