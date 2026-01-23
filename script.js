import init, { ImageProcessor } from './pkg/batch_image_editor.js';

let processor = null;
let showImages = false;

const originalFormats = new Map();

// Resolve selected format or fall back to original image format
function resolveFormat(selectedFormat, index) {
    if (!selectedFormat || selectedFormat === 'null' || selectedFormat === 'none') {
        return originalFormats.get(index) || processor.get_image_format(index);
    }
    return selectedFormat;
}

// Is always running
async function run() {
    await init();
    processor = new ImageProcessor();
    
    document.getElementById('fileInput').addEventListener('change', handleFiles);
    document.getElementById('folderInput').addEventListener('change', handleFiles);
    document.getElementById('toggleBtn').addEventListener('click', toggleImages);
    document.getElementById('downloadBtn').addEventListener('click', downloadAll);
    document.getElementById('clearBtn').addEventListener('click', clearAll);

    document.getElementById('globalScaleRange').addEventListener('input', (e) => {
        document.getElementById('percLabel').innerText = e.target.value + '%';
    });

    document.getElementById('imageList').addEventListener('input', (e) => {
        if (!e.target.classList.contains('w-input') && !e.target.classList.contains('h-input')) return;
        
        const index = e.target.getAttribute('data-index');
        const lockEnabled = document.getElementById(`lock-ratio-${index}`).checked;

        // If the lock ratio toggle is checked
        if (lockEnabled) {
            const widthInput = document.getElementById(`width-${index}`);
            const heightInput = document.getElementById(`height-${index}`);

            const currentW = parseInt(widthInput.value);
            const currentH = parseInt(heightInput.value);

            if (!currentW || !currentH) return;

            const ratio = currentW / currentH; // Width / Height

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
    
    if (imageFiles.length == 0) {
        updateStatus('No image files found.');
        return;
    }
    
    updateStatus(`Processing ${imageFiles.length} images...`);
    
    for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        try {
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            const ext = file.name.split('.').pop().toLowerCase();
            originalFormats.set(processor.get_image_count(), ext);
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
        let format = resolveFormat(processor.get_image_format(i), i);
        const width = dimensions[0];
        const height = dimensions[1];
        
        const imageData = processor.get_image_data(i);
        const mime = (format == 'jpg' || format == 'jpeg') ? 'image/jpeg' : 'image/png';
        const blob = new Blob([imageData], { type: mime });
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

        container.appendChild(imageDiv);

        const img = imageDiv.querySelector('img');
        img.onload = () => URL.revokeObjectURL(url);
    }
}

// Control resizing of single images
window.resizeImage = async function(index) {
    const w = parseInt(document.getElementById(`width-${index}`).value);
    const h = parseInt(document.getElementById(`height-${index}`).value);
    const format = resolveFormat(
        document.getElementById('globalFormat').value,
        index
    );

    // Attempt resize
    try {
        updateStatus(`Processing image ${index + 1}...`);
        await processor.resize_image(index, w, h, format);
        updateStatus('Image resized successfully!');
        displayImages();
    } catch (error) { 
        console.error('Error resizing image:', error);
        updateStatus('Error resizing image: ' + error);
    }
};

// Download a single image
window.downloadSingle = function(index) {
    const name = processor.get_image_name(index);
    const data = processor.get_image_data(index);
    const format = resolveFormat(
        document.getElementById('globalFormat').value,
        index
    );
    
    const mime = (format == 'jpg' || format == 'jpeg') ? 'image/jpeg' : 'image/png';
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const fileName = name.replace(/\.[^/.]+$/, "") + `_edited.${format}`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
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

// Resize all images at once
window.resizeAll = async function() {
    const mode = document.getElementById('batchMode').value;
    const format = document.getElementById('globalFormat').value;
    const count = processor.get_image_count();
    
    updateStatus(`Processing ${count} images...`);

    // Loop through all images
    for (let i = 0; i < count; i++) {
        let finalW, finalH;
        const dims = processor.get_image_dimensions(i);

        if (mode == 'percentage') {
            const scale = document.getElementById('globalScaleRange').value / 100;
            finalW = Math.round(dims[0] * scale);
            finalH = Math.round(dims[1] * scale);
        } else {
            finalW = parseInt(document.getElementById('globalW').value) || dims[0];
            finalH = parseInt(document.getElementById('globalH').value) || dims[1];
        }

        const activeFormat = resolveFormat(format, i);

        await processor.resize_image(i, finalW, finalH, activeFormat);
    }
    
    updateStatus("Batch resize complete!");
    if (showImages) displayImages();
};

// Download all images into a Zip folder
async function downloadAll() {
    updateStatus('Zipping images...');
    const JSZip = (await import('https://cdn.skypack.dev/jszip')).default;
    const zip = new JSZip();
    
    for (let i = 0; i < processor.get_image_count(); i++) {
        const name = processor.get_image_name(i).replace(/\.[^/.]+$/, "");
        const format = resolveFormat(
            document.getElementById('globalFormat').value,
            i
        );
        zip.file(`${name}.${format}`, processor.get_image_data(i));
    }
    
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = 'processed_images.zip';
    document.body.appendChild(a);
    a.click();
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
function updateStatus(msg) { document.getElementById('status').textContent = msg; }

run();