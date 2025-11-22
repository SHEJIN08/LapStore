document.addEventListener('DOMContentLoaded', function() {
    
    // --- 1. SETUP ELEMENTS ---
    const openBtn = document.getElementById('openModalBtn');
    const modalElement = document.getElementById('addCategoryModal');
    const form = document.getElementById('categoryForm');
    
    // Check if elements exist to avoid errors
    if (!modalElement || !form) return;

    // Initialize Bootstrap Modal Controller
    const myModal = new bootstrap.Modal(modalElement);

    // --- 2. OPEN MODAL LOGIC (The "Other Method") ---
    if (openBtn) {
        openBtn.addEventListener('click', function() {
            console.log("Button Clicked!"); // Debugging check
            
            form.reset(); // Clear previous inputs
            myModal.show(); // <--- Manually triggers the modal
        });
    }

    // Focus input when modal opens
    modalElement.addEventListener('shown.bs.modal', function () {
        document.getElementById('catName').focus();
    });

    // --- 3. AXIOS SUBMIT LOGIC ---
    // Your custom Toast function
    function showToast(msg, type) {
        Toastify({
            text: msg,
            duration: 3000,
            gravity: "top",
            position: "right",
            className: "my-custom-toast",
            backgroundColor: type === "success" 
                ? "#28a745" 
                : "linear-gradient(to right, #e52d27, #b31217)"
        }).showToast();
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Gather Data
        const data = {
            categoryName: document.getElementById('catName').value,
            description: document.getElementById('catDesc').value,
            orders: document.getElementById('catOrder').value,
            isListed: document.getElementById('catStatus').value === 'true',
            showInNav: document.getElementById('showNav').checked,
            isFeatured: document.getElementById('isFeatured').checked
        };

        // Validation
        if (!data.categoryName.trim()) {
            showToast("Category Name is required", "error");
            return;
        }

        try {
            // Send Axios Request
            const response = await axios.post('/admin/category/add-category', data);

            if (response.data.success) {
                myModal.hide();
                form.reset();
                showToast("Category Added Successfully!", "success");
                setTimeout(() => { window.location.reload(); }, 1000);
            } else {
                showToast(response.data.message, "error");
            }

        } catch (error) {
            console.error('Error:', error);
            const errMsg = error.response?.data?.message || "Something went wrong";
            showToast(errMsg, "error");
        }
    });
});