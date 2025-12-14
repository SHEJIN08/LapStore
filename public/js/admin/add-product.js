   // ==========================================
    // 1. SPECIFICATIONS LOGIC
    // ==========================================
    const addSpecBtn = document.getElementById('add-spec-btn');
    const specsContainer = document.getElementById('specs-container');

    if(addSpecBtn) {
        addSpecBtn.addEventListener('click', () => {
            const newRow = document.createElement('div');
            newRow.classList.add('spec-row');
            newRow.innerHTML = `
                <div class="spec-group"><input type="text" name="specKeys[]" placeholder="Key" required></div>
                <div class="spec-group"><input type="text" name="specValues[]" placeholder="Value" required></div>
                <button type="button" class="delete-spec" onclick="removeSpec(this)">🗑️</button>
            `;
            specsContainer.appendChild(newRow);
        });
    }

    function removeSpec(button) {
        const row = button.closest('.spec-row');
        const totalRows = document.querySelectorAll('.spec-row').length;
        if (totalRows > 1) {
            row.remove();
        } else {
            row.querySelector('input[name="specKeys[]"]').value = '';
            row.querySelector('input[name="specValues[]"]').value = '';
        }
    }

    // ==========================================
    // 2. VARIANT LOGIC
    // ==========================================
    let variants = [];

    function addVariant() {
        const ram = document.getElementById('v_ram').value;
        const storage = document.getElementById('v_storage').value;
        const color = document.getElementById('v_color').value;
        const stock = document.getElementById('v_stock').value;
         const graphics = document.getElementById('v_graphics').value;

         const regularPrice = parseFloat(document.getElementById('v_price').value); // MRP
         const globalDiscount = parseFloat(document.getElementById('discount').value) || 0; // Global Discount

        if (!ram || !storage || !stock || !graphics) {
            showToast("Please fill all variant fields (RAM, Storage,  Stock, graphics)", 'error');
            return;
        }
        if(regularPrice < 1){
            return showToast('price cannot be negative','error')
        }
     
        if(stock < 1){
            return showToast('Stock cannot be negative', 'error')
        }
        if(globalDiscount > regularPrice || globalDiscount < 1){
            return showToast('Discount cannot be greater that or equal to the price','error')
        }
        

        const salePrice = regularPrice - globalDiscount;

        const newVariant = { ram, storage, color: color || 'Standard', regularPrice: regularPrice, salePrice: salePrice, stock, graphics };
        variants.push(newVariant);
        renderVariants();
        clearInputs();
        updateHiddenInput();
    }

    function renderVariants() {
        const tbody = document.getElementById('variantBody');
        tbody.innerHTML = '';
        variants.forEach((v, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${v.ram}</td>
                <td>${v.storage}</td>
                <td>${v.color}</td>
                <td>
                <span style="text-decoration: line-through; color: #888; margin-right:5px;">₹${v.regularPrice}</span>
                <br>
                <span style="font-weight: bold; color: green;">₹${v.salePrice}</span>
              </td>
                <td>${v.stock}</td>
                 <td>${v.graphics}</td>
                <td><button type="button" onclick="removeVariant(${index})" style="color: red; border: none; background: none;"><i class="bi bi-trash"></i> Remove</button></td>
            `;
            tbody.appendChild(tr);
        });
    }

    function removeVariant(index) {
        variants.splice(index, 1);
        renderVariants();
        updateHiddenInput();
    }

    function clearInputs() {
        document.getElementById('v_ram').value = '';
        document.getElementById('v_storage').value = '';
        document.getElementById('v_price').value = '';
        document.getElementById('v_stock').value = '';
         document.getElementById('v_graphics').value = '';
    }

    function updateHiddenInput() {
        document.getElementById('variantsData').value = JSON.stringify(variants);
    }

    // ==========================================
    // 3. IMAGE UPLOAD & CROPPER LOGIC
    // ==========================================
    let cropper;
    let currentFileIndex = -1;
    const imageInput = document.getElementById('imageInput');
    const previewContainer = document.getElementById('image-preview-container');
    const cropperModal = document.getElementById('cropperModal');
    const imageToCrop = document.getElementById('imageToCrop');
    
    // We use DataTransfer to manipulate the FileList
    const dataTransfer = new DataTransfer();

    // Listen for file selection
    imageInput.addEventListener('change', function(e) {
        const files = this.files;
        for(let i=0; i<files.length; i++){
            dataTransfer.items.add(files[i]);
        }
        // Update input files
        imageInput.files = dataTransfer.files;
        renderPreviews();
    });

    function renderPreviews() {
        previewContainer.innerHTML = '';
        Array.from(dataTransfer.files).forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const div = document.createElement('div');
                div.style.cssText = "position: relative; width: 100px; height: 100px; border: 1px solid #ddd; border-radius: 5px; overflow: hidden; margin-right: 10px; margin-bottom: 10px;";
                
                div.innerHTML = `
                    <img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover;">
                    <button type="button" onclick="openCropper(${index})" style="position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(0,0,0,0.6); color: white; border: none; font-size: 11px; cursor: pointer; padding: 2px;">Crop</button>
                    <button type="button" onclick="removeImage(${index})" style="position: absolute; top: 0; right: 0; background: red; color: white; border: none; width: 20px; height: 20px; font-size: 12px; cursor: pointer; display:flex; align-items:center; justify-content:center;">&times;</button>
                `;
                previewContainer.appendChild(div);
            };
            reader.readAsDataURL(file);
        });
    }

    function openCropper(index) {
        currentFileIndex = index;
        const file = dataTransfer.files[index];
        const reader = new FileReader();
        reader.onload = (e) => {
            imageToCrop.src = e.target.result;
            cropperModal.style.display = 'flex';
            if(cropper) { cropper.destroy(); }
            cropper = new Cropper(imageToCrop, {
                aspectRatio: 1, 
                viewMode: 1,
            });
        };
        reader.readAsDataURL(file);
    }

    function saveCrop() {
        if (!cropper) return;
        cropper.getCroppedCanvas().toBlob((blob) => {
            const originalFile = dataTransfer.files[currentFileIndex];
            const croppedFile = new File([blob], originalFile.name, { type: originalFile.type });

            // Rebuild DataTransfer
            const newDataTransfer = new DataTransfer();
            Array.from(dataTransfer.files).forEach((file, i) => {
                if (i === currentFileIndex) {
                    newDataTransfer.items.add(croppedFile);
                } else {
                    newDataTransfer.items.add(file);
                }
            });

            // Update
            dataTransfer.items.clear();
            Array.from(newDataTransfer.files).forEach(file => dataTransfer.items.add(file));
            imageInput.files = dataTransfer.files;

            renderPreviews();
            closeCropper();
        });
    }

    function closeCropper() {
        cropperModal.style.display = 'none';
        if(cropper) { cropper.destroy(); }
    }

    function removeImage(index) {
        const newDataTransfer = new DataTransfer();
        Array.from(dataTransfer.files).forEach((file, i) => {
            if (i !== index) {
                newDataTransfer.items.add(file);
            }
        });

        dataTransfer.items.clear();
        Array.from(newDataTransfer.files).forEach(file => dataTransfer.items.add(file));
        imageInput.files = dataTransfer.files;
        renderPreviews();
    }

    // ==========================================
    // 4. FORM SUBMISSION
    // ==========================================
    document.addEventListener('DOMContentLoaded', () => {
        const productForm = document.getElementById('addProductForm');
        if (productForm) {
            productForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitBtn = productForm.querySelector('.btn-save');
                
                // --- Validation ---
                if (imageInput.files.length < 3) {
                    showToast('Please select at least 3 product images.', 'error');
                    return;
                }
                if (variants.length === 0) {
                    showToast('Please add at least one variant.', 'error');
                    return;
                }
                // ------------------

                submitBtn.disabled = true;
                submitBtn.innerHTML = 'Saving...';
                
                const formData = new FormData(productForm);

                try {
                    const response = await axios.post('/admin/add-product', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });

                    if (response.data.success) {
                        showToast(response.data.message, 'success');
                        setTimeout(() => window.location.href = '/admin/products', 1000);
                    } else {
                        showToast(response.data.message, 'error');
                        resetBtn(submitBtn);
                    }
                } catch (err) {
                    console.error("Error:", err);
                    showToast("Something went wrong.", 'error');
                    resetBtn(submitBtn);
                }
            });
        }
    });

    function resetBtn(btn) {
        btn.disabled = false;
        btn.innerText = "Save Changes";
    }

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
