const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const db = require('./database/db');

async function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            devTools: true
        }
    });

    try {
        // Initialize database first
        await db.initialize();

        // Set up IPC handlers for database operations
        ipcMain.handle('db:hasMasterPassword', (_, username) => db.hasMasterPassword(username));
        ipcMain.handle('db:setMasterPassword', (_, username, password) => db.setMasterPassword(username, password));
        ipcMain.handle('db:verifyPassword', (_, username, password) => db.verifyPassword(username, password));
        ipcMain.handle('db:addWallet', (_, data) => db.addWallet(data));
        ipcMain.handle('db:getWallets', (_, username, password) => db.getWallets(username, password));
        ipcMain.handle('db:updateWallet', (_, data) => db.updateWallet(data));
        ipcMain.handle('db:deleteWallet', (_, { id, username, password }) => 
            db.deleteWallet(id, username, password));
        ipcMain.handle('db:addNote', (_, data) => db.addNote(data));
        ipcMain.handle('db:getNotes', (_, username, walletId, password) => 
            db.getNotes(username, walletId, password));
        ipcMain.handle('db:deleteNote', (_, id, username, password) => 
            db.deleteNote(id, username, password));

        // Load the login page
        mainWindow.loadFile(path.join(__dirname, '../renderer/pages/login.html'));
        
        // Open DevTools automatically
        mainWindow.webContents.openDevTools();
    } catch (error) {
        dialog.showErrorBox('Database Error', 
            'Failed to initialize the database. Please restart the application.\n\n' + 
            'Error: ' + error.message
        );
        app.quit();
    }
}

// Ensure async initialization is handled properly
app.whenReady().then(createWindow).catch(error => {
    console.error('Failed to start application:', error);
    dialog.showErrorBox('Startup Error', 
        'Failed to start the application.\n\n' + 
        'Error: ' + error.message
    );
    app.quit();
});

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

// Add DevTools keyboard shortcut
app.on('browser-window-created', (_, window) => {
    window.webContents.on('before-input-event', (event, input) => {
        if (input.control && input.key.toLowerCase() === 'i') {
            window.webContents.toggleDevTools();
            event.preventDefault();
        }
    });
});