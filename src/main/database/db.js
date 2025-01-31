const CryptoJS = require('crypto-js');
const path = require('path');
const fs = require('fs');

class SecureDatabase {
    constructor() {
        this.dbPath = path.join(__dirname, '../../../secure-data/wallets.json');
        this.db = null;
        this.defaultData = {
            users: [],
            wallets: [],
            settings: {}
        };
    }

    async initialize() {
        try {
            // Ensure directory exists
            if (!fs.existsSync(path.dirname(this.dbPath))) {
                fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
            }

            // Create database file if it doesn't exist
            if (!fs.existsSync(this.dbPath)) {
                fs.writeFileSync(this.dbPath, JSON.stringify(this.defaultData));
            }

            // Dynamic import of lowdb
            const { Low } = await import('lowdb');
            const { JSONFile } = await import('lowdb/node');

            // Initialize database with default data
            const adapter = new JSONFile(this.dbPath);
            this.db = new Low(adapter, this.defaultData);
            
            // Read existing data
            await this.db.read();

            // Ensure all required properties exist
            this.db.data = {
                ...this.defaultData,
                ...this.db.data
            };

            // Write back to ensure structure
            await this.db.write();
            
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Error initializing database:', error);
            throw error;
        }
    }

    async hasMasterPassword(username) {
        await this.db.read();
        return this.db.data.users.some(user => user.username === username);
    }

    async setMasterPassword(username, password) {
        // Check if username already exists
        if (await this.hasMasterPassword(username)) {
            throw new Error('Username already exists');
        }

        const salt = CryptoJS.lib.WordArray.random(128/8);
        const hashedPassword = CryptoJS.PBKDF2(password, salt, {
            keySize: 256/32,
            iterations: 10000
        }).toString();

        // Add new user
        this.db.data.users.push({
            username,
            hash: hashedPassword,
            salt: salt.toString(),
            createdAt: new Date().toISOString()
        });

        await this.db.write();
    }

    async verifyPassword(username, password) {
        await this.db.read();
        const user = this.db.data.users.find(u => u.username === username);
        if (!user) return false;

        const hashedAttempt = CryptoJS.PBKDF2(password, 
            CryptoJS.enc.Hex.parse(user.salt), {
            keySize: 256/32,
            iterations: 10000
        }).toString();

        return hashedAttempt === user.hash;
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

    async addWallet(username, name, address, privateKey, masterPassword) {
        if (!await this.verifyPassword(username, masterPassword)) {
            throw new Error("Invalid master password");
        }

        await this.db.read();
        const encryptedPrivateKey = this.encrypt(privateKey, masterPassword);
        
        this.db.data.wallets.push({
            id: Date.now(),
            username, // Add username to wallet
            name,
            address,
            privateKey: encryptedPrivateKey,
            createdAt: new Date().toISOString()
        });

        await this.db.write();
    }

    async getWallets(username) {
        await this.db.read();
        
        return this.db.data.wallets
            .filter(wallet => wallet.username === username)
            .map(wallet => ({
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