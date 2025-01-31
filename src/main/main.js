const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./database/db');

async function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    // Initialize database
    await db.initialize();

    // Set up IPC handlers for database operations
    ipcMain.handle('db:hasMasterPassword', () => db.hasMasterPassword());
    ipcMain.handle('db:setMasterPassword', (_, password) => db.setMasterPassword(password));
    ipcMain.handle('db:verifyPassword', (_, password) => db.verifyPassword(password));
    ipcMain.handle('db:addWallet', (_, { name, address, privateKey, password }) => 
        db.addWallet(name, address, privateKey, password));
    ipcMain.handle('db:getWallets', () => db.getWallets());

    // Update path to login.html
    mainWindow.loadFile(path.join(__dirname, '../renderer/pages/login.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});