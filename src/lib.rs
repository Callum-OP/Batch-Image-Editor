use wasm_bindgen::prelude::*;
use image::{ImageBuffer, RgbaImage, DynamicImage};

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub struct ImageProcessor {
    images: Vec<ProcessedImage>,
}

#[wasm_bindgen]
// Image object
pub struct ProcessedImage {
    name: String,
    data: Vec<u8>,
    width: u32,
    height: u32,
    original_data: Vec<u8>,
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
    // Add image to list
    pub fn add_image(&mut self, name: String, data: Vec<u8>) -> Result<(), JsValue> {
        match image::load_from_memory(&data) {
            Ok(img) => {
                let rgba_img = img.to_rgba8();
                let width = rgba_img.width();
                let height = rgba_img.height();
                
                let mut output = Vec::new();
                let encoder = image::codecs::png::PngEncoder::new(&mut output);
                if let Err(e) = encoder.encode(&rgba_img, width, height, image::ColorType::Rgba8) {
                    return Err(JsValue::from_str(&format!("Encoding error: {}", e)));
                }
                
                self.images.push(ProcessedImage {
                    name,
                    data: output,
                    width,
                    height,
                    original_data: data,
                });
                Ok(())
            }
            Err(e) => Err(JsValue::from_str(&format!("Image loading error: {}", e))),
        }
    }

    #[wasm_bindgen]
    pub fn resize_image(&mut self, index: usize, new_width: u32, new_height: u32) -> Result<(), JsValue> {
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
        let rgba_img = resized.to_rgba8();
        let (actual_w, actual_h) = rgba_img.dimensions();
        
        let mut output = Vec::new();
        let encoder = image::codecs::png::PngEncoder::new(&mut output);
        
        if let Err(e) = encoder.encode(&rgba_img, actual_w, actual_h, image::ColorType::Rgba8) {
            return Err(JsValue::from_str(&format!("Encoding error: {}", e)));
        }

        // Update state
        self.images[index].data = output;
        self.images[index].width = actual_w;
        self.images[index].height = actual_h;

        Ok(())
    }

    #[wasm_bindgen]
    // Get number of images in list
    pub fn get_image_count(&self) -> usize {
        self.images.len()
    }

    #[wasm_bindgen]
    // Get image details
    pub fn get_image_data(&self, index: usize) -> Option<js_sys::Uint8Array> {
        if index < self.images.len() {
            Some(js_sys::Uint8Array::from(&self.images[index].data[..]))
        } else {
            None
        }
    }
    #[wasm_bindgen]
    pub fn get_image_name(&self, index: usize) -> Option<String> {
        if index < self.images.len() {
            Some(self.images[index].name.clone())
        } else {
            None
        }
    }
    #[wasm_bindgen]
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