use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Read;
use std::path::Path;

pub fn extract_cover(file_path: &str) -> Result<String, String> {
    let cover_data = generate_placeholder_cover(file_path);
    Ok(cover_data)
}

fn generate_placeholder_cover(file_path: &str) -> String {
    let path = Path::new(file_path);
    let title = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Unknown");

    let color = hash_color(title);
    
    let svg = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400">
            <defs>
                <linearGradient id="grad-{title}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:{color};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:{color}99;stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="300" height="400" fill="url(#grad-{title})"/>
            <text x="150" y="180" text-anchor="middle" fill="white" font-size="20" font-family="Arial" font-weight="bold">
                {title_short}
            </text>
            <text x="150" y="210" text-anchor="middle" fill="white" font-size="14" font-family="Arial" opacity="0.8">
                PDF Document
            </text>
        </svg>"#,
        color = color,
        title = title,
        title_short = if title.len() > 20 { &title[..20] } else { title }
    );

    let encoded = general_purpose::STANDARD.encode(svg.as_bytes());
    format!("data:image/svg+xml;base64,{}", encoded)
}

fn hash_color(s: &str) -> String {
    let hash: u32 = s.bytes().fold(0, |acc, b| acc.wrapping_add(b as u32).wrapping_mul(17));
    let r = (hash >> 16) & 0xFF;
    let g = (hash >> 8) & 0xFF;
    let b = hash & 0xFF;
    format!("#{:02x}{:02x}{:02x}", r, g, b)
}

pub fn read_pdf_file(file_path: &str) -> Result<Vec<u8>, String> {
    let mut file = File::open(file_path)
        .map_err(|e| format!("Failed to open PDF file: {}", e))?;

    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)
        .map_err(|e| format!("Failed to read PDF file: {}", e))?;

    Ok(buffer)
}

pub fn get_pdf_metadata(file_path: &str) -> Result<PdfMetadata, String> {
    use std::fs;
    
    let metadata = fs::metadata(file_path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;

    let file_size = metadata.len();
    
    let path = Path::new(file_path);
    let title = path
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.to_string());

    Ok(PdfMetadata {
        num_pages: 0,
        title,
        author: None,
        file_size,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfMetadata {
    pub num_pages: usize,
    pub title: Option<String>,
    pub author: Option<String>,
    pub file_size: u64,
}
