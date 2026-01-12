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
            <h3>${name}</h3>
            <p>Original: ${width} x ${height}</p>
            <div class="image-controls">
                <label>Width: <input type="number" id="width-${i}" class="w-input" data-index="${i}" value="${width}"></label>
                <label>Height: <input type="number" id="height-${i}" class="h-input" data-index="${i}" value="${height}"></label>
                <label><input type="checkbox" id="lock-ratio-${i}" checked> Lock Ratio</label>
                <button onclick="resizeImage(${i})">Apply Resize</button>
            </div>
            <img src="${url}" alt="${name}" class="preview-image">
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
    
    const a = document.createElement('a');
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
function updateStatus(message) {
    document.getElementById('status').textContent = message;
}

run();