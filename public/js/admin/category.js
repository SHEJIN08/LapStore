document.addEventListener('DOMContentLoaded', () => {

    // 1. Select Elements
    const modal = document.getElementById('confirmationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalCatName = document.getElementById('modalCatName');
    const actionText = document.getElementById('actionText');
    const modalSubText = document.getElementById('modalSubText');
    const confirmBtn = document.getElementById('confirmActionBtn');
    const closeBtn = document.querySelector('.modal-close-btn');
    const cancelBtn = document.getElementById('cancelModalBtn');

    let targetId = null;

    // Toast Helper
    const showToast = (msg, type) => {
        if (typeof Toastify === 'function') {
            Toastify({
                text: msg,
                duration: 3000,
                gravity: "top",
                position: "right",
                style: { background: type === "success" ? "#28a745" : "#dc3545" }
            }).showToast();
        } else {
            alert(msg);
        }
    };

    // 2. Function to Open Modal
    const openModal = (id, name, action) => {
        targetId = id;
        modalCatName.textContent = name;
        modal.style.display = 'flex';

        if (action === 'unlist') {
            // UI for Unlisting (Red/Warning)
            modalTitle.textContent = "Unlist Category";
            actionText.textContent = "unlist";
            actionText.style.color = "#dc3545"; 
            modalSubText.textContent = "This category will be hidden from users.";
            
            confirmBtn.textContent = "Unlist";
            confirmBtn.style.backgroundColor = "#dc3545"; // Red
        } else {
            // UI for Listing (Green/Safe)
            modalTitle.textContent = "List Category";
            actionText.textContent = "list";
            actionText.style.color = "#28a745"; 
            modalSubText.textContent = "This category will be visible to users.";
            
            confirmBtn.textContent = "List";
            confirmBtn.style.backgroundColor = "#28a745"; // Green
        }
    };

    // 3. Attach Event Listeners to Buttons
    
    // Handle "Unlist" (Block) buttons
    document.body.addEventListener('click', (e) => {
        // Use closest() to handle clicks on the icon inside the button
        const btn = e.target.closest('.block-btn');
        if (btn) {
            e.preventDefault();
            const id = btn.getAttribute('data-id');
            const name = btn.getAttribute('data-name');
            openModal(id, name, 'unlist');
        }
    });

    // Handle "List" (Unblock) buttons
    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('.unblock-btn');
        if (btn) {
            e.preventDefault();
            const id = btn.getAttribute('data-id');
            const name = btn.getAttribute('data-name');
            openModal(id, name, 'list');
        }
    });

    // 4. Confirm Action (Axios)
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            if (!targetId) return;

            try {
                // Ensure this route matches your backend router.post('/category/toggle-status/:id')
                const response = await axios.patch(`/admin/category/toggle-status/${targetId}`, {});

                if (response.data.success) {
                    showToast(response.data.message, "success");
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    showToast(response.data.message, "error");
                }
            } catch (err) {
                console.error(err);
                showToast("Something went wrong", "error");
            }
            modal.style.display = 'none';
        });
    }

    // 5. Close Modal Logic
    const hideModal = () => { modal.style.display = 'none'; };
    if (closeBtn) closeBtn.addEventListener('click', hideModal);
    if (cancelBtn) cancelBtn.addEventListener('click', hideModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) hideModal();
    });



// --- NEW: Add Category Form Handling ---
    const categoryForm = document.getElementById('categoryForm');

    if (categoryForm) {
        categoryForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // 1. Stop the browser from reloading

            // 2. Get data from the form
            const formData = new FormData(categoryForm);
            // Convert FormData to a simple JavaScript Object
            const data = Object.fromEntries(formData.entries());

            try {
                // 3. Send via Axios
                const response = await axios.post('/admin/category/add-category', data);

                if (response.data.success) {
                    // 4. Success: Show Toast & Reload
                    Toastify({
                        text: response.data.message,
                        duration: 3000,
                        gravity: "top",
                        position: "right",
                        style: { background: "#28a745" } // Green
                    }).showToast();

                    // Close modal and reload page after 1 second
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                } else {
                    // Logic failure (e.g. name already exists)
                    Toastify({
                        text: response.data.message,
                        duration: 3000,
                        gravity: "top",
                        position: "right",
                        style: { background: "#dc3545" } // Red
                    }).showToast();
                }

            } catch (error) {
                console.error("Error adding category:", error);
                // 5. Network/Server Error
                const errMsg = error.response?.data?.message || "Something went wrong";
                Toastify({
                    text: errMsg,
                    duration: 3000,
                    gravity: "top",
                    position: "right",
                    style: { background: "#dc3545" }
                }).showToast();
            }
        });
    }

    });