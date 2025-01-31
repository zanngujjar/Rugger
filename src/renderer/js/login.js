const { ipcRenderer } = require('electron');

const welcomeContainer = document.getElementById('welcome-container');
const setupContainer = document.getElementById('setup-container');
const loginContainer = document.getElementById('login-container');
const message = document.getElementById('message');

// Show password requirements when focusing on password input
document.getElementById('new-password').addEventListener('focus', () => {
    document.querySelector('.password-requirements').style.display = 'block';
});

// Navigation functions
function showWelcome() {
    welcomeContainer.style.display = 'block';
    setupContainer.style.display = 'none';
    loginContainer.style.display = 'none';
    message.textContent = '';
}

document.getElementById('login-btn').addEventListener('click', () => {
    welcomeContainer.style.display = 'none';
    loginContainer.style.display = 'block';
});

document.getElementById('register-btn').addEventListener('click', () => {
    welcomeContainer.style.display = 'none';
    setupContainer.style.display = 'block';
});

// Setup form submit
document.getElementById('setup-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (password.length < 8) {
        message.textContent = 'Password must be at least 8 characters long';
        return;
    }

    if (password !== confirmPassword) {
        message.textContent = 'Passwords do not match!';
        return;
    }

    try {
        // Check if username exists
        const exists = await ipcRenderer.invoke('db:hasMasterPassword', username);
        if (exists) {
            message.textContent = 'Username already exists';
            return;
        }

        await ipcRenderer.invoke('db:setMasterPassword', username, password);
        localStorage.setItem('username', username);
        localStorage.setItem('masterPassword', password);
        window.location.href = 'index.html';
    } catch (error) {
        message.textContent = 'Error creating account: ' + error.message;
    }
});

// Login form submit
document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const isValid = await ipcRenderer.invoke('db:verifyPassword', username, password);
        if (!isValid) {
            message.textContent = 'Invalid username or password';
            return;
        }
        localStorage.setItem('username', username);
        localStorage.setItem('masterPassword', password);
        window.location.href = 'index.html';
    } catch (error) {
        message.textContent = 'Error logging in: ' + error.message;
    }
});

// Initialize with welcome screen
showWelcome(); 