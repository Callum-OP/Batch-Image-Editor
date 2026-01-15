import init, { ImageProcessor } from './pkg/batch_image_editor.js';

let processor = null;
let showImages = false;

// Is always running
async function run() {
    await init();
    processor = new ImageProcessor();
    
    document.getElementById('fileInput').addEventListener('change', handleFiles);
    document.getElementById('folderInput').addEventListener('change', handleFiles);
    document.getElementById('toggleBtn').addEventListener('click', toggleImages);
    document.getElementById('downloadBtn').addEventListener('click', downloadAll);
    document.getElementById('clearBtn').addEventListener('click', clearAll);

    document.getElementById('imageList').addEventListener('input', (e) => {
        if (!e.target.classList.contains('w-input') && !e.target.classList.contains('h-input')) return;
        
        const index = e.target.getAttribute('data-index');
        const lockEnabled = document.getElementById(`lock-ratio-${index}`).checked;

        // If the lock ratio toggle is checked
        if (lockEnabled) {
            const dims = processor.get_image_dimensions(parseInt(index));
            const ratio = dims[0] / dims[1]; // Width / Height

            const widthInput = document.getElementById(`width-${index}`);
            const heightInput = document.getElementById(`height-${index}`);

            // Ensure both width and height remain at same ratio
            if (e.target.classList.contains('w-input')) {
                // Update Height based on new Width
                heightInput.value = Math.round(e.target.value / ratio);
            } else {
                // Update Width based on new Height
                widthInput.value = Math.round(e.target.value * ratio);
            }
        }
    });
    
    updateStatus('Select some images to get started.');
}

// Read files
async function handleFiles(event) {
    const files = Array.from(event.target.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
        updateStatus('No image files found.');
        return;
    }
    
    updateStatus(`Processing ${imageFiles.length} images...`);
    
    for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        try {
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            await processor.add_image(file.name, uint8Array);
        } catch (error) {
            console.error(`Error processing ${file.name}:`, error);
        }
    }
    
    updateStatus(`Loaded ${processor.get_image_count()} images.`);
    document.getElementById('downloadBtn').disabled = false;
    
    if (showImages) {
        displayImages();
    }
}

// Toggle to show or hide images
function toggleImages() {
    showImages = !showImages;
    const btn = document.getElementById('toggleBtn');
    btn.textContent = showImages ? 'Hide Images' : 'Show Images';
    
    if (showImages) {
        displayImages();
    } else {
        document.getElementById('imageList').innerHTML = '';
    }
}

// For displaying images and their options
function displayImages() {
    const container = document.getElementById('imageList');
    container.innerHTML = '';
    
    const count = processor.get_image_count();
    
    // For every image
    for (let i = 0; i < count; i++) {
        const imageDiv = document.createElement('div');
        imageDiv.className = 'image-container';
        imageDiv.style.display = 'block';
        
        // Get image details
        const name = processor.get_image_name(i);
        const dimensions = processor.get_image_dimensions(i);
        const width = dimensions[0];
        const height = dimensions[1];
        
        const imageData = processor.get_image_data(i);
        const blob = new Blob([imageData], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        
        // Add html
        imageDiv.innerHTML = `
            <div class="card shadow-sm mb-4">
                <div class="card-header bg-light">
                    <h5 class="card-title mb-0 text-truncate">${name}</h5>
                </div>
                
                <div class="card-body">
                    <div class="text-center mb-3 bg-dark rounded p-2">
                        <img src="${url}" alt="${name}" class="img-fluid rounded border shadow-sm" style="max-height: 250px;">
                    </div>

                    <p class="text-muted small mb-3">
                        <i class="fas fa-info-circle me-1"></i> Current size: <strong>${width} x ${height}</strong>
                    </p>

                    <div class="row g-2 mb-3">
                        <div class="col">
                            <div class="input-group input-group-sm">
                                <span class="input-group-text">W</span>
                                <input type="number" id="width-${i}" class="form-control w-input" data-index="${i}" value="${width}">
                            </div>
                        </div>
                        <div class="col">
                            <div class="input-group input-group-sm">
                                <span class="input-group-text">H</span>
                                <input type="number" id="height-${i}" class="form-control h-input" data-index="${i}" value="${height}">
                            </div>
                        </div>
                    </div>

                    <div class="d-flex justify-content-between align-items-center">
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" role="switch" id="lock-ratio-${i}" checked>
                            <label class="form-check-label small" for="lock-ratio-${i}">Lock Ratio</label>
                        </div>

                        <button class="btn btn-sm btn-primary" onclick="resizeImage(${i})">
                            <i class="fas fa-expand me-1"></i> Apply
                        </button>

                        <button class="btn btn-sm btn-outline-success" onclick="downloadSingle(${i})">
                            <i class="fas fa-download me-1"></i> Download
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add to index file
        container.appendChild(imageDiv);
    }
}

// Control resizing of images
window.resizeImage = async function(index) {
    const widthInput = document.getElementById(`width-${index}`);
    const heightInput = document.getElementById(`height-${index}`);
    const lockCheckbox = document.getElementById(`lock-ratio-${index}`);
    
    let newWidth = parseInt(widthInput.value);
    let newHeight = parseInt(heightInput.value);
    
    // If ratio is locked then ensure dimensions remain the same ratio
    if (lockCheckbox.checked) {
        const originalDims = processor.get_image_dimensions(index);
        const ratio = originalDims[0] / originalDims[1];
        
        // If width was the last thing changed, adjust height and vice-versa
        newHeight = Math.round(newWidth / ratio);
    }

    await processor.resize_image(index, newWidth, newHeight);
    
    // Ensure image can't be smaller than 0
    if (newWidth <= 0 || newHeight <= 0) {
        alert('Width and height must be positive numbers');
        return;
    }
    
    try {
        updateStatus(`Resizing image ${index + 1}...`);
        await processor.resize_image(index, newWidth, newHeight);
        updateStatus('Image resized successfully!');
        
        if (showImages) {
            displayImages();
        }
    } catch (error) {
        console.error('Error resizing image:', error);
        updateStatus('Error resizing image: ' + error);
    }
};

// Download a single image
window.downloadSingle = function(index) {
    const name = processor.get_image_name(index);
    const imageData = processor.get_image_data(index);
    
    // Convert the PNG bytes into a Blob
    const blob = new Blob([imageData], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    
    // Clean up the filename (replace extension with .png)
    const baseName = name.replace(/\.[^/.]+$/, "");
    const fileName = `${baseName}_edited.png`;
    
    // Create a temporary hidden download link and click it
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    // Remove temp link
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    updateStatus(`Downloaded ${fileName}`);
};

// Toggle between UI rezise inputs
window.toggleBatchInputs = function() {
    const mode = document.getElementById('batchMode').value;
    document.getElementById('percGroup').classList.toggle('d-none', mode !== 'percentage');
    document.getElementById('pixelGroup').classList.toggle('d-none', mode !== 'pixels');
};

// Resize all iamges at once
window.resizeAll= async function() {
    const mode = document.getElementById('batchMode').value;
    const count = processor.get_image_count();
    
    if (count === 0) return alert("No images to resize!");

    updateStatus(`Processing ${count} images...`);

    // Loop through all images
    for (let i = 0; i < count; i++) {
        let finalW, finalH;

        if (mode === 'percentage') {
            const scale = document.getElementById('globalScaleRange').value / 100;
            const dims = processor.get_image_dimensions(i);
            finalW = Math.round(dims[0] * scale);
            finalH = Math.round(dims[1] * scale);
        } else {
            finalW = parseInt(document.getElementById('globalW').value);
            finalH = parseInt(document.getElementById('globalH').value);
        }

        if (finalW > 0 && finalH > 0) {
            await processor.resize_image(i, finalW, finalH);
        }
    }

    updateStatus("Batch resize complete!");
    if (showImages) displayImages();
};

// Download all images into a Zip folder
async function downloadAll() {
    const count = processor.get_image_count();
    
    if (count === 0) {
        alert('No images to download');
        return;
    }
    
    updateStatus('Preparing download...');
    
    // Use dynamic import for JSZip
    const JSZip = (await import('https://cdn.skypack.dev/jszip')).default;
    const zip = new JSZip();
    
    for (let i = 0; i < count; i++) {
        const name = processor.get_image_name(i);
        const imageData = processor.get_image_data(i);
        
        // Remove extension and add .png
        const baseName = name.replace(/\.[^/.]+$/, "");
        const fileName = `${baseName}.png`;
        
        zip.file(fileName, imageData);
    }
    
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary hidden download link and click it
    const a = document.createElement('a');
    a.href = url;
    a.download = 'processed_images.zip';
    document.body.appendChild(a);
    a.click();
    // Remove temp link
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    updateStatus('Download completed!');
}

// Clear all images
function clearAll() {
    processor.clear();
    document.getElementById('imageList').innerHTML = '';
    document.getElementById('fileInput').value = '';
    document.getElementById('folderInput').value = '';
    document.getElementById('downloadBtn').disabled = true;
    updateStatus('All images cleared.');
}

// Keep a status message to let the user know what is happening
function updateStatus(message) {
    document.getElementById('status').textContent = message;
}

run();