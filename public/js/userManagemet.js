document.addEventListener("DOMContentLoaded", function() {
    
    // Get all action buttons
    const actionButtons = document.querySelectorAll('.action-btn');

    actionButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevents the window click from firing immediately
            
            // Find the dropdown related to this button
            const dropdown = button.closest('.action-cell').querySelector('.action-dropdown');

            // Close all other open dropdowns
            document.querySelectorAll('.action-dropdown.show').forEach(openDropdown => {
                if (openDropdown !== dropdown) {
                    openDropdown.classList.remove('show');
                }
            });

            // Toggle the 'show' class on the clicked dropdown
            dropdown.classList.toggle('show');
        });
    });

    // Close dropdowns if user clicks outside
    window.addEventListener('click', () => {
        document.querySelectorAll('.action-dropdown.show').forEach(openDropdown => {
            openDropdown.classList.remove('show');
        });
    });
});