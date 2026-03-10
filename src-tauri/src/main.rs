#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod library;
mod pdf_handler;

use library::{Book, LibraryManager};
use pdf_handler::{extract_cover, get_pdf_metadata, read_pdf_file};
use serde_json::Value;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::Mutex;
use tauri::State;
use tauri_plugin_store::StoreExt;

struct AppState {
    library: Mutex<LibraryManager>,
}

#[tauri::command]
fn get_library(state: State<'_, AppState>) -> Result<Vec<Book>, String> {
    let library = state.library.lock().map_err(|_| "Failed to lock library")?;
    library.get_books()
}

#[tauri::command]
fn scan_library(state: State<'_, AppState>, directory: String) -> Result<Vec<Book>, String> {
    let mut library = state.library.lock().map_err(|_| "Failed to lock library")?;
    library.scan_directory(&directory)
}

#[tauri::command]
fn search_library(state: State<'_, AppState>, query: String) -> Result<Vec<Book>, String> {
    let library = state.library.lock().map_err(|_| "Failed to lock library")?;
    library.search_books(&query)
}

#[tauri::command]
fn get_book_cover(state: State<'_, AppState>, book_id: String) -> Result<String, String> {
    let mut library = state.library.lock().map_err(|_| "Failed to lock library")?;
    let book = library.get_book_by_id(&book_id).cloned();
    
    if let Some(b) = book {
        library.get_cover(&b)
    } else {
        Err("Book not found".to_string())
    }
}

#[tauri::command]
fn update_book_page(state: State<'_, AppState>, book_id: String, page: u32) -> Result<(), String> {
    let mut library = state.library.lock().map_err(|_| "Failed to lock library")?;
    library.update_current_page(&book_id, page)
}

#[tauri::command]
async fn extract_cover_command(file_path: String) -> Result<String, String> {
    extract_cover(&file_path)
}

#[tauri::command]
async fn read_pdf_file_command(file_path: String) -> Result<Vec<u8>, String> {
    read_pdf_file(&file_path)
}

#[tauri::command]
async fn get_pdf_metadata_command(file_path: String) -> Result<pdf_handler::PdfMetadata, String> {
    get_pdf_metadata(&file_path)
}

#[tauri::command]
fn get_home_dir() -> String {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default()
}

fn hash_path(path: &str) -> String {
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

#[tauri::command]
async fn save_workspace_state(
    app: tauri::AppHandle,
    pdf_path: String,
    last_page: u32,
    pinned_pages: Vec<u32>,
    layout: String,
) -> Result<(), String> {
    let key = hash_path(&pdf_path);
    let store = app
        .store("workspace_state.json")
        .map_err(|e| format!("Failed to open store: {}", e))?;
    let value = serde_json::json!({
        "lastPage": last_page,
        "pinnedPages": pinned_pages,
        "layout": layout
    });
    store.set(&key, value);
    Ok(())
}

#[tauri::command]
async fn load_workspace_state(
    app: tauri::AppHandle,
    pdf_path: String,
) -> Result<Option<Value>, String> {
    let key = hash_path(&pdf_path);
    let store = app
        .store("workspace_state.json")
        .map_err(|e| format!("Failed to open store: {}", e))?;
    Ok(store.get(&key))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(AppState {
            library: Mutex::new(LibraryManager::new()),
        })
        .invoke_handler(tauri::generate_handler![
            get_library,
            scan_library,
            search_library,
            get_book_cover,
            update_book_page,
            extract_cover_command,
            read_pdf_file_command,
            get_pdf_metadata_command,
            get_home_dir,
            save_workspace_state,
            load_workspace_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
