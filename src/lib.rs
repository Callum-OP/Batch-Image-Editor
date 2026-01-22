use wasm_bindgen::prelude::*;
use image::{ImageBuffer, RgbaImage, DynamicImage};
use std::io::Cursor;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
pub struct ImageProcessor {
    images: Vec<ProcessedImage>,
}

#[wasm_bindgen]
pub struct ProcessedImage {
    name: String,
    data: Vec<u8>,
    width: u32,
    height: u32,
    original_data: Vec<u8>,
    format: String, // Tracks current output format
}

#[wasm_bindgen]
impl ImageProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> ImageProcessor {
        ImageProcessor {
            images: Vec::new(),
        }
    }

    #[wasm_bindgen]
    pub fn add_image(&mut self, name: String, data: Vec<u8>) -> Result<(), JsValue> {
        match image::load_from_memory(&data) {
            Ok(img) => {
                let rgba_img = img.to_rgba8();
                let width = rgba_img.width();
                let height = rgba_img.height();
                
                let mut output = Vec::new();
                // Default to PNG for initial load
                let mut cursor = Cursor::new(&mut output);
                rgba_img.write_to(&mut cursor, image::ImageFormat::Png)
                    .map_err(|e| JsValue::from_str(&format!("Encoding error: {}", e)))?;
                
                self.images.push(ProcessedImage {
                    name,
                    data: output,
                    width,
                    height,
                    original_data: data,
                    format: "png".to_string(),
                });
                Ok(())
            }
            Err(e) => Err(JsValue::from_str(&format!("Image loading error: {}", e))),
        }
    }

    #[wasm_bindgen]
    // Add image to list
    pub fn resize_image(&mut self, index: usize, new_width: u32, new_height: u32, format: String) -> Result<(), JsValue> {
        if index >= self.images.len() {
            return Err(JsValue::from_str("Image index out of bounds"));
        }

        // Load from the original data stored in the struct
        let original_img = match image::load_from_memory(&self.images[index].original_data) {
            Ok(img) => img,
            Err(e) => return Err(JsValue::from_str(&format!("Failed to load original image: {}", e))),
        };

        // Resize images, using resize_exact as it allows stretching
        let resized = original_img.resize_exact(new_width, new_height, image::imageops::FilterType::Lanczos3);
        let mut output = Vec::new();
        let mut cursor = Cursor::new(&mut output);

        // Reformat image
        if format.to_lowercase() == "jpg" || format.to_lowercase() == "jpeg" {
            // JPEG doesn't support transparency so give it a white background
            let rgb_img = resized.to_rgb8();
            rgb_img.write_to(&mut cursor, image::ImageFormat::Jpeg)
                .map_err(|e| JsValue::from_str(&format!("JPEG Encoding error: {}", e)))?;
            self.images[index].format = "jpg".to_string();
        } else {
            let rgba_img = resized.to_rgba8();
            rgba_img.write_to(&mut cursor, image::ImageFormat::Png)
                .map_err(|e| JsValue::from_str(&format!("PNG Encoding error: {}", e)))?;
            self.images[index].format = "png".to_string();
        }

        // Update state
        self.images[index].data = output;
        self.images[index].width = resized.width();
        self.images[index].height = resized.height();

        Ok(())
    }

    #[wasm_bindgen]
    // Get number of images in list
    pub fn get_image_count(&self) -> usize {
        self.images.len()
    }

    #[wasm_bindgen]
    // Get file type
    pub fn get_image_format(&self, index: usize) -> Option<String> {
        self.images.get(index).map(|img| img.format.clone())
    }
    #[wasm_bindgen]
    // Get image details
    pub fn get_image_data(&self, index: usize) -> Option<js_sys::Uint8Array> {
        self.images.get(index).map(|img| js_sys::Uint8Array::from(&img.data[..]))
    }
    #[wasm_bindgen]
    // Name
    pub fn get_image_name(&self, index: usize) -> Option<String> {
        self.images.get(index).map(|img| img.name.clone())
    }
    #[wasm_bindgen]
    // Size
    pub fn get_image_dimensions(&self, index: usize) -> Option<js_sys::Array> {
        if index < self.images.len() {
            let result = js_sys::Array::new();
            result.push(&JsValue::from(self.images[index].width));
            result.push(&JsValue::from(self.images[index].height));
            Some(result)
        } else {
            None
        }
    }

    #[wasm_bindgen]
    // Clear list
    pub fn clear(&mut self) {
        self.images.clear();
    }
}