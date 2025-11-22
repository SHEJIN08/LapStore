document.addEventListener('DOMContentLoaded', () => {
 

    // 1. Setup Modal Elements
    const blockModal = document.getElementById('blockModal');
    const modalUserName = document.getElementById('modalUserName');
    const confirmBlockBtn = document.getElementById('confirmBlockBtn');
    const closeBtn = document.querySelector('.modal-close-btn');
    const cancelBtn = document.querySelector('.btn-cancel');
    
    let userIdToBlock = null; // Store ID to block

    // --- HELPER: Toast Function ---
    const showToast = (msg, type) => {
        Toastify({
            text: msg,
            duration: 3000,
            gravity: "top",
            position: "right",
            backgroundColor: type === "success" ? "#28a745" : "#dc3545",
        }).showToast();
    };

    // --- HELPER: Axios Request ---
    const toggleUserStatus = async (userId) => {
        try {
            // Make POST request to your backend
            const response = await axios.post(`/admin/users/toggle-block/${userId}`);

            if (response.data.success) {
                showToast(response.data.message, "success");
                // Reload page to update UI (Badge/Buttons)
                setTimeout(() => window.location.reload(), 1000);
            } else {
                showToast(response.data.message, "error");
            }
        } catch (error) {
            console.error(error);
            showToast("Something went wrong", "error");
        }
    };

    // 2. EVENT: Click "Unblock" (Direct Action)
    document.querySelectorAll('.unblock-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.getAttribute('data-user-id');
            toggleUserStatus(userId);
        });
    });

    // 3. EVENT: Click "Block" (Opens Modal)
    document.querySelectorAll('.block-user-trigger').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            userIdToBlock = this.getAttribute('data-user-id'); // Save ID
            const userName = this.getAttribute('data-user-name');
            
            // Update Modal Text
            modalUserName.textContent = userName;
            blockModal.style.display = 'flex';
        });
    });

    // 4. EVENT: Confirm Block (Inside Modal)
    if (confirmBlockBtn) {
        confirmBlockBtn.addEventListener('click', function() {
            if (userIdToBlock) {
                toggleUserStatus(userIdToBlock);
                blockModal.style.display = 'none';
            }
        });
    }

    // 5. Close Modal Logic
    const hideModal = () => { blockModal.style.display = 'none'; };
    
    if (closeBtn) closeBtn.addEventListener('click', hideModal);
    if (cancelBtn) cancelBtn.addEventListener('click', hideModal);
    
    window.addEventListener('click', (e) => {
        if (e.target === blockModal) hideModal();
    });
});