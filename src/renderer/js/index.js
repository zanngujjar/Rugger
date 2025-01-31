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
    console.log('Starting wallet form submission...');
    event.preventDefault();

    const name = document.getElementById('wallet-name').value;
    const address = document.getElementById('wallet-address').value;
    const masterPassword = localStorage.getItem('masterPassword');

    try {
        console.log('Adding new wallet...');
        await ipcRenderer.invoke('db:addWallet', { 
            username,
            name, 
            address,
            password: masterPassword 
        });
        console.log('Wallet added successfully');
        event.target.reset();
        await loadWallets();
        console.log('Form submission completed');
    } catch (error) {
        console.error('Error in form submission:', error);
        alert("Error storing wallet: " + error.message);
    }
});

// Load wallets
async function loadWallets() {
    console.log('Starting loadWallets...');
    try {
        const masterPassword = localStorage.getItem('masterPassword');
        if (!masterPassword) {
            console.error("No master password found");
            window.location.href = 'login.html';
            return;
        }

        console.log('Fetching wallets from database...');
        const wallets = await ipcRenderer.invoke('db:getWallets', username, masterPassword);
        const walletList = document.getElementById('wallet-list');
        
        if (!walletList) {
            console.error("Wallet list element not found");
            return;
        }

        console.log(`Rendering ${wallets.length} wallets...`);
        walletList.innerHTML = wallets.map(wallet =>
            `<div class="wallet-card" data-wallet-id="${wallet.id}">
                <div class="wallet-main">
                    <div class="wallet-info">
                        <div class="wallet-name">${wallet.name || 'Unnamed Wallet'}</div>
                        <div class="wallet-address">${wallet.address || 'No Address'}</div>
                    </div>
                    <div class="wallet-actions">
                        <button type="button" class="edit-btn" data-id="${wallet.id}" data-name="${wallet.name}" data-address="${wallet.address}">
                            Edit
                        </button>
                        <button type="button" class="delete-btn" data-id="${wallet.id}">
                            Delete
                        </button>
                        <button type="button" class="notes-btn" data-id="${wallet.id}">
                            Notes
                        </button>
                    </div>
                </div>
                <div id="notes-section-${wallet.id}" class="notes-section hidden">
                    <div class="notes-input">
                        <textarea id="note-input-${wallet.id}" placeholder="Add a note..."></textarea>
                        <button type="button" class="add-note-btn" data-wallet-id="${wallet.id}">Add Note</button>
                    </div>
                    <div id="notes-${wallet.id}" class="notes-list"></div>
                </div>
            </div>`
        ).join('');

        console.log('Attaching event listeners...');
        attachWalletEventListeners();
        console.log('loadWallets completed successfully');

    } catch (error) {
        console.error("Error in loadWallets:", error);
    }
}

// Separate function to attach event listeners
function attachWalletEventListeners() {
    console.log('Starting attachWalletEventListeners...');
    
    // Edit buttons
    const editButtons = document.querySelectorAll('.edit-btn');
    console.log(`Found ${editButtons.length} edit buttons`);
    editButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            console.log('Edit button clicked:', e.target.dataset);
            const { id, name, address } = e.target.dataset;
            editWallet(id, name, address);
        });
    });

    // Delete buttons
    const deleteButtons = document.querySelectorAll('.delete-btn');
    console.log(`Found ${deleteButtons.length} delete buttons`);
    deleteButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            console.log('Delete button clicked:', e.target.dataset);
            e.stopPropagation();
            const id = e.target.dataset.id;
            await deleteWallet(id);
        });
    });

    // Notes buttons
    const noteButtons = document.querySelectorAll('.notes-btn');
    console.log(`Found ${noteButtons.length} note buttons`);
    noteButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            console.log('Notes button clicked:', e.target.dataset);
            e.stopPropagation();
            const id = e.target.dataset.id;
            toggleNotes(id);
        });
    });

    // Add note buttons
    document.querySelectorAll('.add-note-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const walletId = e.target.dataset.walletId;
            addNote(walletId);
        });
    });

    console.log('Event listeners attached successfully');
}

// Edit wallet functionality
window.editWallet = function(id, name, address) {
    console.log('Starting editWallet:', { id, name, address });
    document.getElementById('edit-wallet-id').value = id;
    document.getElementById('edit-wallet-name').value = name;
    document.getElementById('edit-wallet-address').value = address;
    document.getElementById('edit-modal').style.display = 'block';
    console.log('Edit modal opened');
};

window.closeEditModal = function() {
    document.getElementById('edit-modal').style.display = 'none';
};

// Update the edit wallet submission
document.getElementById('edit-wallet-form').addEventListener('submit', async (event) => {
    console.log('Starting edit form submission...');
    event.preventDefault();
    const id = document.getElementById('edit-wallet-id').value;
    const name = document.getElementById('edit-wallet-name').value;
    const address = document.getElementById('edit-wallet-address').value;
    const masterPassword = localStorage.getItem('masterPassword');

    try {
        console.log('Updating wallet:', { id, name, address });
        await ipcRenderer.invoke('db:updateWallet', {
            id: parseInt(id),
            username,
            name,
            address,
            password: masterPassword
        });
        console.log('Wallet updated successfully');
        closeEditModal();
        await loadWallets();
        console.log('Edit form submission completed');
    } catch (error) {
        console.error('Error in edit form submission:', error);
        alert("Error updating wallet: " + error.message);
    }
});

// Update delete wallet function
async function deleteWallet(id) {
    console.log('Starting deleteWallet for ID:', id);
    if (!confirm('Are you sure you want to delete this wallet?')) {
        console.log('Deletion cancelled by user');
        return;
    }

    try {
        const masterPassword = localStorage.getItem('masterPassword');
        console.log('Sending delete request to main process...');
        await ipcRenderer.invoke('db:deleteWallet', {
            id,
            username,
            password: masterPassword
        });

        console.log('Wallet deleted from database, updating DOM...');
        const walletCard = document.querySelector(`[data-wallet-id="${id}"]`);
        if (walletCard) {
            walletCard.remove();
            console.log('Wallet card removed from DOM');
        } else {
            console.log('Wallet card not found in DOM');
        }

        console.log('Reloading wallet list...');
        await loadWallets();
        console.log('Delete operation completed successfully');
    } catch (error) {
        console.error('Error in deleteWallet:', error);
        alert("Error deleting wallet: " + error.message);
    }
}

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

// Add these functions to handle notes

async function addNote(walletId) {
    const note = document.getElementById(`note-input-${walletId}`).value;
    if (!note.trim()) return;

    try {
        const masterPassword = localStorage.getItem('masterPassword');
        await ipcRenderer.invoke('db:addNote', {
            username,
            walletId,
            note,
            password: masterPassword
        });
        document.getElementById(`note-input-${walletId}`).value = '';
        loadNotes(walletId);
    } catch (error) {
        alert("Error adding note: " + error.message);
    }
}

async function loadNotes(walletId) {
    try {
        const masterPassword = localStorage.getItem('masterPassword');
        const notes = await ipcRenderer.invoke('db:getNotes', username, walletId, masterPassword);
        
        const notesHtml = notes.map(note => `
            <div class="note-item">
                <div class="note-content">${note.note}</div>
                <div class="note-meta">
                    <span>${new Date(note.createdAt).toLocaleString()}</span>
                    <button onclick="deleteNote('${note.id}')" class="delete-btn">Delete</button>
                </div>
            </div>
        `).join('');

        document.getElementById(`notes-${walletId}`).innerHTML = notesHtml;
    } catch (error) {
        console.error("Error loading notes:", error);
    }
}

async function deleteNote(noteId) {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
        const masterPassword = localStorage.getItem('masterPassword');
        await ipcRenderer.invoke('db:deleteNote', noteId, username, masterPassword);
        // Reload notes for the current wallet
        const walletId = document.querySelector('.wallet-notes.active')?.dataset.walletId;
        if (walletId) {
            loadNotes(walletId);
        }
    } catch (error) {
        alert("Error deleting note: " + error.message);
    }
}

// Add toggle function for notes
window.toggleNotes = function(walletId) {
    const notesSection = document.getElementById(`notes-section-${walletId}`);
    const isHidden = notesSection.classList.contains('hidden');
    
    // Hide all notes sections first
    document.querySelectorAll('.notes-section').forEach(section => {
        section.classList.add('hidden');
    });

    if (isHidden) {
        notesSection.classList.remove('hidden');
        loadNotes(walletId);
    }
};

// Initial load
loadWallets(); 