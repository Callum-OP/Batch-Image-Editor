use wasm_bindgen::prelude::*;
use js_sys::Array;
use web_sys::{File, Url};

#[wasm_bindgen]
pub fn generate_image_html(show: bool, files: Array) -> String {
    // Show message if images are not being shown
    if !show {
        return "<p>Images hidden</p>".to_string();
    }

    let mut html = String::new();

    // Go through each file in the folder
    for file in files.iter() {
        let file = web_sys::File::from(file);
        let name = file.name();

        // Only show images
        if !(name.ends_with(".png") || name.ends_with(".jpg") || name.ends_with(".jpeg")) {
            continue;
        }

        let url = web_sys::Url::create_object_url_with_blob(&file).unwrap();

        html.push_str(&format!(
            r#"<div><img src="{}" style="max-width:200px;"></div>"#,
            url
        ));
    }

    html
}
