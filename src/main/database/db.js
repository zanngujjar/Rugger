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

    async getUserSaltAndHash(username) {
        await this.db.read();
        const user = this.db.data.users.find(u => u.username === username);
        if (!user) return null;
        return {
            salt: user.salt,
            hash: user.hash
        };
    }

    encryptWalletData(data, password, salt) {
        // Create a unique key for wallet encryption using user's password and salt
        const encryptionKey = CryptoJS.PBKDF2(password, salt, {
            keySize: 256/32,
            iterations: 5000
        }).toString();

        return CryptoJS.AES.encrypt(JSON.stringify(data), encryptionKey).toString();
    }

    decryptWalletData(encryptedData, password, salt) {
        try {
            const encryptionKey = CryptoJS.PBKDF2(password, salt, {
                keySize: 256/32,
                iterations: 5000
            }).toString();

            const bytes = CryptoJS.AES.decrypt(encryptedData, encryptionKey);
            return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        } catch (error) {
            console.error("Decryption failed:", error);
            return null;
        }
    }

    async addWallet(data) {
        const { username, name, address, password } = data;
        
        if (!await this.verifyPassword(username, password)) {
            throw new Error("Invalid master password");
        }

        await this.db.read();
        const userCreds = await this.getUserSaltAndHash(username);
        
        // Prepare wallet data
        const walletData = {
            name,
            address,
            createdAt: new Date().toISOString()
        };

        // Encrypt wallet data
        const encryptedData = this.encryptWalletData(walletData, password, userCreds.salt);
        
        this.db.data.wallets.push({
            id: Date.now(),
            username,
            data: encryptedData
        });

        await this.db.write();
    }

    async getWallets(username, password) {
        await this.db.read();
        const userCreds = await this.getUserSaltAndHash(username);
        if (!userCreds) return [];

        const userWallets = this.db.data.wallets.filter(w => w.username === username);
        
        return userWallets.map(wallet => {
            const decryptedData = this.decryptWalletData(
                wallet.data, 
                password, 
                userCreds.salt
            );

            if (!decryptedData) return null;

            return {
                id: wallet.id,
                name: decryptedData.name,
                address: decryptedData.address,
                createdAt: decryptedData.createdAt
            };
        }).filter(Boolean);
    }

    async updateWallet(data) {
        const { id, username, name, address, password } = data;
        await this.db.read();
        const userCreds = await this.getUserSaltAndHash(username);
        
        const index = this.db.data.wallets.findIndex(
            w => w.id === id && w.username === username
        );

        if (index !== -1) {
            // Prepare updated wallet data
            const walletData = {
                name,
                address,
                createdAt: this.db.data.wallets[index].createdAt,
                updatedAt: new Date().toISOString()
            };

            // Encrypt updated data
            const encryptedData = this.encryptWalletData(
                walletData,
                password,
                userCreds.salt
            );

            this.db.data.wallets[index] = {
                id,
                username,
                data: encryptedData
            };

            await this.db.write();
        }
    }

    async deleteWallet(id, username, password) {
        // Verify password first
        if (!await this.verifyPassword(username, password)) {
            throw new Error("Invalid master password");
        }

        await this.db.read();
        
        // Get user credentials for potential note deletion
        const userCreds = await this.getUserSaltAndHash(username);
        
        // Delete the wallet
        this.db.data.wallets = this.db.data.wallets.filter(
            w => !(w.id === parseInt(id) && w.username === username)
        );

        // Also delete any associated notes
        if (this.db.data.notes) {
            this.db.data.notes = this.db.data.notes.filter(
                n => !(n.walletId === parseInt(id) && n.username === username)
            );
        }

        await this.db.write();
    }

    async getWalletPrivateKey(id, password) {
        await this.db.read()
        
        const wallet = this.db.data.wallets.find(w => w.id === id);
        if (!wallet) return null;

        return this.decrypt(wallet.privateKey, password);
    }

    async addNote(data) {
        const { username, walletId, note, password } = data;
        
        if (!await this.verifyPassword(username, password)) {
            throw new Error("Invalid master password");
        }

        await this.db.read();
        const userCreds = await this.getUserSaltAndHash(username);
        
        // Prepare note data
        const noteData = {
            id: Date.now(),
            note,
            createdAt: new Date().toISOString()
        };

        // Encrypt note data
        const encryptedData = this.encryptWalletData(noteData, password, userCreds.salt);
        
        // Initialize notes array if it doesn't exist
        if (!this.db.data.notes) {
            this.db.data.notes = [];
        }

        this.db.data.notes.push({
            id: noteData.id,
            walletId,
            username,
            data: encryptedData
        });

        await this.db.write();
        return noteData.id;
    }

    async getNotes(username, walletId, password) {
        await this.db.read();
        const userCreds = await this.getUserSaltAndHash(username);
        if (!userCreds) return [];

        if (!this.db.data.notes) {
            this.db.data.notes = [];
            await this.db.write();
            return [];
        }

        const userNotes = this.db.data.notes.filter(
            n => n.username === username && n.walletId === walletId
        );
        
        return userNotes.map(note => {
            const decryptedData = this.decryptWalletData(
                note.data, 
                password, 
                userCreds.salt
            );

            if (!decryptedData) return null;

            return {
                id: note.id,
                note: decryptedData.note,
                createdAt: decryptedData.createdAt
            };
        }).filter(Boolean);
    }

    async deleteNote(id, username, password) {
        if (!await this.verifyPassword(username, password)) {
            throw new Error("Invalid master password");
        }

        await this.db.read();
        this.db.data.notes = (this.db.data.notes || []).filter(
            n => !(n.id === id && n.username === username)
        );
        await this.db.write();
    }
}

module.exports = new SecureDatabase(); 