document.addEventListener('DOMContentLoaded', function() {
    const openBtn = document.getElementById('openModalBtn');
    const modalElement = document.getElementById('addCategoryModal');
    const firstInput = document.getElementById('catName');

    // Check if modal exists before running logic (prevents errors on other pages)
    if (modalElement) {
        const myModal = new bootstrap.Modal(modalElement);

        if (openBtn) {
            openBtn.addEventListener('click', function() {
                // Note: Standard forms don't clear automatically on re-open 
                // unless you explicitly reset them here:
                document.getElementById('categoryForm').reset();
                myModal.show();
            });
        }

        modalElement.addEventListener('shown.bs.modal', function () {
            firstInput.focus();
        });
    }
});