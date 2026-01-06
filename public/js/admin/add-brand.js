
document.addEventListener('DOMContentLoaded', () => {
            const form = document.getElementById('addBrandForm');
            const uploadContainer = document.getElementById('uploadContainer');
            const fileInput = document.getElementById('fileInput');
            const uploadContent = document.getElementById('uploadContent');
            const previewContent = document.getElementById('previewContent');
            const imagePreview = document.getElementById('imagePreview');
            const removeBtn = document.getElementById('removeImageBtn');
            const submitBtn = document.getElementById('submitBtn');

            // Toast Helper
             const showToast = (message, type) => {
            const bgColor = type === 'success' ? "linear-gradient(to right, #30E527, #238500)" : "linear-gradient(to right, #e52d27, #b31217)";
            Toastify({
                text: message,
                duration: 3000,
                gravity: "top", 
                position: "right", 
                style: { background: bgColor, borderRadius: '10px' }
            }).showToast();
        };
    const Loading = {
    // 1. Show Full Page Loader
    show: function(text = "Processing...") {
        const loader = document.getElementById('global-loader');
        const textEl = loader.querySelector('p');
        if (textEl) textEl.innerText = text;
        loader.style.display = 'flex';
    },

    // 2. Hide Full Page Loader
    hide: function() {
        document.getElementById('global-loader').style.display = 'none';
    },

    // 3. Turn a Button into a Loader
    showButton: function(btnElement) {
        btnElement.classList.add('btn-loading');
        btnElement.disabled = true; // Prevent double clicks
    },

    // 4. Restore Button
    hideButton: function(btnElement) {
        btnElement.classList.remove('btn-loading');
        btnElement.disabled = false;
    }
};

            // --- CROPPER SETUP ---
            let cropper; // Variable to hold the cropper instance

            uploadContainer.addEventListener('click', () => {
                if (fileInput.value === '') fileInput.click();
            });

            fileInput.addEventListener('change', function(e) {
                const file = this.files[0];
                if (file) {
                    // Cleanup previous cropper if it exists
                    if (cropper) {
                        cropper.destroy();
                        cropper = null;
                    }

                    const reader = new FileReader();
                    reader.onload = function(event) {
                        imagePreview.src = event.target.result;
                        uploadContent.style.display = 'none';
                        previewContent.style.display = 'block'; // Use block for better container fit

                        // Initialize Cropper once image is loaded
                        cropper = new Cropper(imagePreview, {
                            aspectRatio: 1, // Force a square crop (1:1). Change to NaN for free crop.
                            viewMode: 2,    // Restrict crop box to not exceed image bounds
                            autoCropArea: 1, // Initial crop area percentage
                        });
                    }
                    reader.readAsDataURL(file);
                }
            });

            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                fileInput.value = '';
                imagePreview.src = '';
                // Destroy cropper on remove
                if (cropper) {
                    cropper.destroy();
                    cropper = null;
                }
                uploadContent.style.display = 'flex';
                previewContent.style.display = 'none';
            });


            // --- AXIOS SUBMISSION WITH CROPPER ---
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                Loading.showButton(submitBtn)

                // Basic validation
                if (!fileInput.files[0] && !cropper) {
                    Loading.hideButton(submitBtn)
                    showToast("Please upload a brand logo", "error");
                    return;
                }
                

                if (cropper) {
                    cropper.getCroppedCanvas({
                        width: 400, // Optional: resize target width
                        height: 400 // Optional: resize target height
                    }).toBlob(async (blob) => {
                        // This block runs once the image is cropped and converted
                        await sendDataToBackend(blob);
                    }, 'image/jpeg', 0.9); // Output format and quality (0.9 = 90%)
                } else {
                    // Fallback: if for some reason cropper didn't load, send original file
                    const originalFile = fileInput.files[0];
                    await sendDataToBackend(originalFile);
                }
            });

            // Helper function to send data
            async function sendDataToBackend(fileToSend) {
                 try {
                    // 1. Create FormData based on existing form text fields
                    const formData = new FormData(form);
                    
                    // 2. IMPORTANT: Replace the 'brandLogo' file with the new (cropped) file
                    // The third argument 'brand-logo.jpg' is the filename the server will see
                    formData.set('brandLogo', fileToSend, 'brand-logo.jpg');

                    // 3. Send via Axios
                    const response = await axios.post('/admin/brands/add', formData);

                    if (response.data.success) {
                        showToast(response.data.message, "success");
                        setTimeout(() => {
                            window.location.href = '/admin/brands';
                        }, 1000);
                    } else {
                        Loading.hideButton(submitBtn)
                        showToast(response.data.message, "error");
                    }

                } catch (error) {
                     Loading.hideButton(submitBtn)
                    console.error('Error:', error);
                    const errMsg = error.response?.data?.message || "Something went wrong";
                    showToast(errMsg, "error");
                }
            }
        });