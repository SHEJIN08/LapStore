document.addEventListener('DOMContentLoaded', () => {

    // 1. Select Elements
    const modal = document.getElementById('confirmationModal');
    const modalUserName = document.getElementById('modalUserName');
    const modalTitle = document.getElementById('modalTitle');
    const actionText = document.getElementById('actionText');
    const modalSubText = document.getElementById('modalSubText');
    const confirmBtn = document.getElementById('confirmActionBtn');
    const closeBtn = document.querySelector('.modal-close-btn');
    const cancelBtn = document.querySelector('.btn-cancel');
    
    let targetUserId = null; // Store ID to operate on

    // --- HELPER: Toast Function ---
    const showToast = (msg, type) => {
        if (typeof Toastify === 'function') {
            Toastify({
                text: msg,
                duration: 3000,
                gravity: "top",
                position: "right",
                // Fixed: Use style.background instead of backgroundColor
                style: { background: type === "success" ? "#28a745" : "#dc3545" }
            }).showToast();
        } else {
            alert(msg);
        }
    };

    // --- HELPER: Axios Request ---
    const toggleUserStatus = async (userId) => {
        try {
            // Fixed: Added empty object {} to prevent 400 Bad Request
            const response = await axios.post(`/admin/users/toggle-block/${userId}`, {});

            if (response.data.success) {
                showToast(response.data.message, "success");
                setTimeout(() => window.location.reload(), 1000);
            } else {
                showToast(response.data.message, "error");
            }
        } catch (error) {
            console.error(error);
            showToast(error.response?.data?.message || "Something went wrong", "error");
        }
    };

    // 2. Open Modal Logic
    const openModal = (userId, userName, actionType) => {
        targetUserId = userId;
        modalUserName.textContent = userName;
        modal.style.display = 'flex';

        if (actionType === 'block') {
            // UI for Blocking (Red)
            modalTitle.textContent = "Block User";
            actionText.textContent = "block";
            actionText.style.color = "#dc3545"; // Red
            modalSubText.textContent = "This user will no longer be able to login.";
            
            confirmBtn.textContent = "Block User";
            confirmBtn.style.backgroundColor = "#dc3545"; // Red
        } else {
            // UI for Unblocking (Green)
            modalTitle.textContent = "Unblock User";
            actionText.textContent = "unblock";
            actionText.style.color = "#28a745"; // Green
            modalSubText.textContent = "This user will be allowed to login again.";
            
            confirmBtn.textContent = "Unblock User";
            confirmBtn.style.backgroundColor = "#28a745"; // Green
        }
    };

    // 3. EVENT: Click "Unblock" (Now opens modal)
    document.querySelectorAll('.unblock-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault(); // Stop dropdown from closing immediately
            const userId = this.getAttribute('data-user-id');
            const userName = this.getAttribute('data-user-name') || 'this user';
            openModal(userId, userName, 'unblock');
        });
    });

    // 4. EVENT: Click "Block" (Opens Modal)
    document.querySelectorAll('.block-user-trigger').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const userId = this.getAttribute('data-user-id');
            const userName = this.getAttribute('data-user-name');
            openModal(userId, userName, 'block');
        });
    });

    // 5. EVENT: Confirm Action (Inside Modal)
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function() {
            if (targetUserId) {
                toggleUserStatus(targetUserId);
                modal.style.display = 'none';
            }
        });
    }

    // 6. Close Modal Logic
    const hideModal = () => { modal.style.display = 'none'; };
    
    if (closeBtn) closeBtn.addEventListener('click', hideModal);
    if (cancelBtn) cancelBtn.addEventListener('click', hideModal);
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) hideModal();
    });
});