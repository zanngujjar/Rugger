const { ipcRenderer } = require('electron');

// Get username from localStorage
const username = localStorage.getItem('username');
document.getElementById('username-display').textContent = username;

// Navigation
document.querySelectorAll('.nav-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.add('hidden');
        });
        
        const sectionId = button.dataset.section;
        document.getElementById(sectionId).classList.remove('hidden');
    });
});

// Wallet form submission
document.getElementById('wallet-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('wallet-name').value;
    const address = document.getElementById('wallet-address').value;
    const privateKey = document.getElementById('wallet-private-key').value;
    const masterPassword = localStorage.getItem('masterPassword');

    try {
        await ipcRenderer.invoke('db:addWallet', { 
            username,
            name, 
            address, 
            privateKey, 
            password: masterPassword 
        });
        event.target.reset();
        loadWallets();
    } catch (error) {
        alert("Error storing wallet: " + error.message);
    }
});

// Load wallets
async function loadWallets() {
    try {
        const wallets = await ipcRenderer.invoke('db:getWallets', username);
        document.getElementById('wallet-list').innerHTML = wallets.map(wallet =>
            `<div class="wallet-card">
                <div class="wallet-info">
                    <div class="wallet-name">${wallet.name}</div>
                    <div class="wallet-address">${wallet.address}</div>
                </div>
                <div class="wallet-actions">
                    <button class="edit-btn" onclick="editWallet('${wallet.id}', '${wallet.name}', '${wallet.address}')">
                        Edit
                    </button>
                    <button class="delete-btn" onclick="deleteWallet('${wallet.id}')">
                        Delete
                    </button>
                </div>
            </div>`
        ).join('');
    } catch (error) {
        console.error("Error loading wallets:", error);
    }
}

// Edit wallet functionality
window.editWallet = function(id, name, address) {
    document.getElementById('edit-wallet-id').value = id;
    document.getElementById('edit-wallet-name').value = name;
    document.getElementById('edit-wallet-address').value = address;
    document.getElementById('edit-modal').style.display = 'block';
};

window.closeEditModal = function() {
    document.getElementById('edit-modal').style.display = 'none';
};

document.getElementById('edit-wallet-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = document.getElementById('edit-wallet-id').value;
    const name = document.getElementById('edit-wallet-name').value;
    const address = document.getElementById('edit-wallet-address').value;

    try {
        await ipcRenderer.invoke('db:updateWallet', {
            id,
            username,
            name,
            address
        });
        closeEditModal();
        loadWallets();
    } catch (error) {
        alert("Error updating wallet: " + error.message);
    }
});

// Delete wallet functionality
window.deleteWallet = async function(id) {
    if (confirm('Are you sure you want to delete this wallet?')) {
        try {
            await ipcRenderer.invoke('db:deleteWallet', { id, username });
            loadWallets();
        } catch (error) {
            alert("Error deleting wallet: " + error.message);
        }
    }
};

// Logout functionality
document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('username');
    localStorage.removeItem('masterPassword');
    window.location.href = 'login.html';
});

// Save notes functionality
document.getElementById('save-notes').addEventListener('click', () => {
    const notes = document.getElementById('wallet-notes').value;
    // TODO: Implement notes saving functionality
    alert('Notes saved!');
});

// Initial load
loadWallets(); 