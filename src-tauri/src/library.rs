use chrono::Utc;
use glob::glob;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Read;
use std::path::PathBuf;
use uuid::Uuid;

const LIBRARY_CACHE_FILE: &str = "library_cache.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Book {
    pub id: String,
    pub title: String,
    pub file_path: String,
    pub cover_path: String,
    pub author: Option<String>,
    pub total_pages: u32,
    pub current_page: u32,
    pub added_at: i64,
    pub last_opened: Option<i64>,
    pub file_size: u64,
    pub file_hash: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct LibraryCache {
    books: Vec<Book>,
    library_path: String,
    last_scanned: i64,
}

pub struct LibraryManager {
    books: Vec<Book>,
    library_path: Option<PathBuf>,
    cache_dir: PathBuf,
    cover_cache: HashMap<String, String>,
}

impl LibraryManager {
    pub fn new() -> Self {
        let cache_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("MimicReader")
            .join("cache");

        let _ = fs::create_dir_all(&cache_dir);

        let mut manager = LibraryManager {
            books: Vec::new(),
            library_path: None,
            cache_dir,
            cover_cache: HashMap::new(),
        };

        manager.load_cache();
        manager
    }

    pub fn scan_directory(&mut self, directory: &str) -> Result<Vec<Book>, String> {
        let pattern = format!("{}/**/*.pdf", directory);
        let mut books = Vec::new();
        for entry in glob(&pattern).map_err(|e| format!("Glob pattern error: {}", e))? {
            match entry {
                Ok(path) => {
                    let path_str = path.to_string_lossy().to_string();
                    if let Some(existing_book) = self.books.iter().find(|b| b.file_path == path_str) {
                        if self.is_file_unchanged(&path, existing_book) {
                            books.push(existing_book.clone());
                            continue;
                        }
                    }

                    match self.create_book_from_path(&path) {
                        Some(book) => books.push(book),
                        None => eprintln!("Failed to process: {:?}", path),
                    }
                }
                Err(e) => eprintln!("Error reading path: {}", e),
            }
        }

        self.books = books.clone();
        self.library_path = Some(PathBuf::from(directory));
        self.save_cache();

        eprintln!("Library scan complete: {} PDFs found", books.len());
        Ok(books)
    }

    pub fn get_books(&self) -> Result<Vec<Book>, String> {
        Ok(self.books.clone())
    }

    pub fn search_books(&self, query: &str) -> Result<Vec<Book>, String> {
        let query_lower = query.to_lowercase();
        let results = self
            .books
            .iter()
            .filter(|book| {
                book.title.to_lowercase().contains(&query_lower)
                    || book
                        .author
                        .as_ref()
                        .map_or(false, |a| a.to_lowercase().contains(&query_lower))
            })
            .cloned()
            .collect();
        Ok(results)
    }

    pub fn get_book_by_id(&self, id: &str) -> Option<&Book> {
        self.books.iter().find(|book| book.id == id)
    }

    pub fn update_current_page(&mut self, book_id: &str, page: u32) -> Result<(), String> {
        if let Some(book) = self.books.iter_mut().find(|b| b.id == book_id) {
            book.current_page = page;
            book.last_opened = Some(Utc::now().timestamp());
            self.save_cache();
            Ok(())
        } else {
            Err(format!("Book with id {} not found", book_id))
        }
    }

    pub fn get_cover(&mut self, book: &Book) -> Result<String, String> {
        if let Some(cached) = self.cover_cache.get(&book.id) {
            return Ok(cached.clone());
        }

        let cover_data = crate::pdf_handler::extract_cover(&book.file_path)?;
        self.cover_cache.insert(book.id.clone(), cover_data.clone());
        Ok(cover_data)
    }

    fn create_book_from_path(&self, path: &PathBuf) -> Option<Book> {
        let title = path
            .file_stem()?
            .to_str()?
            .to_string();

        let file_size = fs::metadata(path).ok()?.len();
        let file_hash = self.compute_file_hash(path);
        let total_pages = self.get_pdf_page_count(path).unwrap_or(0);

        let author = self.extract_author_from_path(path);

        Some(Book {
            id: Uuid::new_v4().to_string(),
            title,
            file_path: path.to_string_lossy().to_string(),
            cover_path: String::new(),
            author,
            total_pages,
            current_page: 1,
            added_at: Utc::now().timestamp(),
            last_opened: None,
            file_size,
            file_hash,
        })
    }

    fn extract_author_from_path(&self, path: &PathBuf) -> Option<String> {
        path.parent()
            .and_then(|p| p.file_name())
            .and_then(|s| s.to_str())
            .map(|s| s.to_string())
    }

    fn get_pdf_page_count(&self, path: &PathBuf) -> Option<u32> {
        let metadata = fs::metadata(path).ok()?;
        let file_size = metadata.len();
        
        if file_size == 0 {
            return Some(0);
        }

        let mut file = File::open(path).ok()?;
        let mut header = [0u8; 8];
        file.read_exact(&mut header).ok()?;
        
        if &header[..5] != b"%PDF-" {
            return None;
        }

        let mut content = Vec::new();
        file.read_to_end(&mut content).ok()?;

        let content_str = String::from_utf8_lossy(&content);
        let page_count = content_str.matches("/Type /Page").count() as u32;
        
        Some(page_count.max(1))
    }

    fn compute_file_hash(&self, path: &PathBuf) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        if let Ok(metadata) = fs::metadata(path) {
            let mut hasher = DefaultHasher::new();
            path.hash(&mut hasher);
            metadata.len().hash(&mut hasher);
            format!("{:x}", hasher.finish())
        } else {
            String::new()
        }
    }

    fn is_file_unchanged(&self, path: &PathBuf, book: &Book) -> bool {
        if let Ok(metadata) = fs::metadata(path) {
            metadata.len() == book.file_size
        } else {
            false
        }
    }

    fn load_cache(&mut self) {
        let cache_file = self.cache_dir.join(LIBRARY_CACHE_FILE);
        if cache_file.exists() {
            if let Ok(data) = fs::read_to_string(&cache_file) {
                if let Ok(cache) = serde_json::from_str::<LibraryCache>(&data) {
                    self.books = cache.books;
                    self.library_path = Some(PathBuf::from(cache.library_path));
                    eprintln!("Loaded {} books from cache", self.books.len());
                }
            }
        }
    }

    fn save_cache(&self) {
        let cache = LibraryCache {
            books: self.books.clone(),
            library_path: self
                .library_path
                .as_ref()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default(),
            last_scanned: Utc::now().timestamp(),
        };

        let cache_file = self.cache_dir.join(LIBRARY_CACHE_FILE);
        let _ = fs::write(cache_file, serde_json::to_string_pretty(&cache).unwrap_or_default());
    }
}

impl Default for LibraryManager {
    fn default() -> Self {
        Self::new()
    }
}
