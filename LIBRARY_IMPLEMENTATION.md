# Library Module Implementation Details

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    LibraryView.vue                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Search Bar  │  │ Sort Select │  │  Scan/Refresh Btn   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                           │                                 │
│                    ┌──────▼──────┐                          │
│                    │ Book Cards  │                          │
│                    │   (Grid)    │                          │
│                    └──────┬──────┘                          │
└───────────────────────────┼──────────────────────────────────┘
                            │
                    ┌───────▼───────┐
                    │  Pinia Store  │
                    │  bookStore.ts │
                    └───────┬───────┘
                            │ Tauri IPC
┌───────────────────────────▼──────────────────────────────────┐
│                    Rust Backend                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  library.rs │  │   main.rs   │  │  pdf_handler.rs     │  │
│  │  - scan     │  │  - Commands │  │  - Cover extract    │  │
│  │  - cache    │  │  - IPC      │  │  - Metadata         │  │
│  │  - search   │  │             │  │  - Rendering        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                           │                                 │
│                    ┌──────▼──────┐                          │
│                    │ File System │                          │
│                    └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. LibraryView.vue

**State Management:**
```typescript
const searchQuery = ref('')
const sortBy = ref<'title' | 'addedAt' | 'lastOpened'>('addedAt')
const isScanning = ref(false)
const showDirectoryInput = ref(false)
```

**Computed Properties:**
- `filteredBooks`: Filters by search query (title/author)
- `sortedBooks`: Applies sorting logic

**Key Functions:**
- `loadLibrary()`: Initial library load
- `scanDirectory()`: Scan custom directory
- `handleSearch()`: Debounced search
- `generatePlaceholderCover()`: Fallback cover generation

### 2. BookCard.vue

**Props:**
```typescript
defineProps<{
  book: Book
}>()
```

**Features:**
- Hover animation (translateY + scale)
- Progress bar visualization
- "Recent" badge for lastOpened books
- Lazy loading cover images
- Error fallback for missing covers

**Progress Calculation:**
```typescript
const progressPercent = computed(() => {
  if (props.book.totalPages === 0) return 0
  return Math.round((props.book.currentPage / props.book.totalPages) * 100)
})
```

### 3. bookStore.ts (Pinia)

**State:**
```typescript
books: ref<Book[]>([])
currentBook: ref<Book | null>(null)
isLoading: ref(false)
isScanning: ref(false)
error: ref<string | null>(null)
heldPage: ref<number | null>(null)  // For Fingerhold feature
```

**Actions:**
- `loadLibrary()`: Fetch from Rust backend
- `scanDirectory()`: Scan new directory
- `searchBooks()`: Server-side search
- `openBook()`: Set current reading book
- `closeBook()`: Save progress and close
- `updateCurrentPage()`: Update page with sync
- `holdPage()`: Set fingerhold bookmark
- `releaseHold()`: Clear fingerhold
- `returnToHeldPage()`: Navigate back with animation

## Rust Backend Details

### library.rs

**LibraryManager Struct:**
```rust
pub struct LibraryManager {
    books: Vec<Book>,
    library_path: Option<PathBuf>,
    cache_dir: PathBuf,
    cover_cache: HashMap<String, String>,
}
```

**Key Methods:**

1. `scan_directory(&mut self, directory: &str) -> Result<Vec<Book>, String>`
   - Uses `glob` crate for recursive PDF finding
   - Checks existing cache to skip unchanged files
   - Updates library cache after scan

2. `get_books(&self) -> Result<Vec<Book>, String>`
   - Returns cloned book list

3. `search_books(&self, query: &str) -> Result<Vec<Book>, String>`
   - Case-insensitive title/author search
   - Returns matching books

4. `get_cover(&mut self, book: &Book) -> Result<String, String>`
   - Checks memory cache first
   - Checks disk cache second
   - Generates new cover if needed

5. `update_current_page(&mut self, book_id: &str, page: u32) -> Result<(), String>`
   - Updates page number
   - Sets last_opened timestamp
   - Saves cache to disk

**Cache System:**
```rust
fn load_cache(&mut self) {
    let cache_file = self.cache_dir.join("library_cache.json");
    // Deserialize and populate self.books
}

fn save_cache(&self) {
    let cache = LibraryCache {
        books: self.books.clone(),
        library_path: ...,
        last_scanned: Utc::now().timestamp(),
    };
    // Serialize to library_cache.json
}
```

### pdf_handler.rs

**Cover Extraction:**
```rust
pub fn extract_cover(file_path: &str) -> Result<String, String> {
    // 1. Open PDF file
    // 2. Parse with pdf crate
    // 3. Get first page
    // 4. Render to ImageBuffer
    // 5. Encode as JPEG
    // 6. Return as base64 data URL
}
```

**Text Rendering on Cover:**
- Custom bitmap font rendering
- 5x6 pixel character patterns
- Scaled 2x for visibility
- Centered on colored background

**Metadata Extraction:**
```rust
pub fn get_pdf_metadata(file_path: &str) -> Result<PdfMetadata, String> {
    // Extract from PDF Info dictionary:
    // - /Title
    // - /Author
    // - Page count
}
```

### main.rs (Tauri Commands)

**Registered Commands:**
```rust
tauri::generate_handler![
    get_library,           // GET all books
    scan_library,          // POST scan directory
    search_library,        // GET search results
    get_book_cover,        // GET cover image
    update_book_page,      // PUT progress update
    extract_cover_command, // GET cover (direct)
    read_pdf_file_command, // GET PDF bytes
    get_pdf_metadata_command // GET metadata
]
```

## Data Flow Examples

### 1. Initial Library Load

```
User opens app
    ↓
LibraryView.vue mounted()
    ↓
bookStore.loadLibrary()
    ↓
Tauri invoke('get_library')
    ↓
Rust: library.get_books()
    ↓
Return Book[] (from cache)
    ↓
For each book: invoke('get_book_cover')
    ↓
Update book.coverPath with base64
    ↓
Render BookCard grid
```

### 2. Directory Scan

```
User clicks "Add Folder"
    ↓
Enter directory path
    ↓
Click "Scan"
    ↓
bookStore.scanDirectory(path)
    ↓
Tauri invoke('scan_library', { directory: path })
    ↓
Rust: LibraryManager::scan_directory()
    ├─ Glob pattern: "{path}/**/*.pdf"
    ├─ For each PDF:
    │   ├─ Check if unchanged (file size/hash)
    │   ├─ If new/changed: create_book_from_path()
    │   └─ Extract: title, pages, author, size
    └─ Save cache
    ↓
Return Book[]
    ↓
Generate covers for new books
    ↓
Update UI grid
```

### 3. Search

```
User types in search bar
    ↓
Debounce (immediate in current impl)
    ↓
bookStore.searchBooks(query)
    ↓
Tauri invoke('search_library', { query })
    ↓
Rust: library.search_books(&query)
    ├─ Convert to lowercase
    └─ Filter: title.contains() || author.contains()
    ↓
Return filtered Book[]
    ↓
Update bookStore.books
    ↓
Vue reactivity updates grid
```

### 4. Open Book

```
User clicks BookCard
    ↓
BookCard emits 'open' event
    ↓
LibraryView.handleOpenBook(book)
    ↓
bookStore.openBook(book)
    ├─ Set currentBook
    └─ Clear heldPage
    ↓
Vue router/conditional renders ReaderView
    ↓
ReaderView loads PDF with PDF.js
```

## Error Handling

### Frontend Error Handling

```typescript
try {
  const result = await invoke<Book[]>('get_library')
  bookStore.books = result
} catch (e) {
  bookStore.error = e instanceof Error 
    ? e.message 
    : 'Failed to load library'
  console.error('Failed to load library:', e)
}
```

### Backend Error Handling

```rust
pub fn scan_directory(&mut self, directory: &str) -> Result<Vec<Book>, String> {
    // Use Result type for error propagation
    let pattern = format!("{}/**/*.pdf", directory);
    
    for entry in glob(&pattern).map_err(|e| format!("Glob error: {}", e))? {
        match entry {
            Ok(path) => { /* process */ }
            Err(e) => eprintln!("Error: {}", e), // Log but continue
        }
    }
    
    Ok(books)
}
```

## Performance Considerations

### 1. Lazy Cover Loading
```typescript
// Don't block initial render
Promise.allSettled(
  books.map(book => 
    invoke('get_book_cover', { bookId: book.id })
      .then(cover => book.coverPath = cover)
  )
)
```

### 2. Incremental Scanning
```rust
fn is_file_unchanged(&self, path: &PathBuf, book: &Book) -> bool {
    if let Ok(metadata) = fs::metadata(path) {
        metadata.len() == book.file_size  // Quick check
    } else {
        false
    }
}
```

### 3. Cover Caching
```rust
// Memory cache for session
if let Some(cached) = self.cover_cache.get(&book.id) {
    return Ok(cached.clone());
}

// Disk cache for persistence
let cover_path = self.cache_dir.join(format!("{}_cover.jpg", book.id));
if cover_path.exists() {
    // Load from disk
}
```

## Testing the Library Module

### Manual Testing Checklist

- [ ] Scan default Documents directory
- [ ] Scan custom directory
- [ ] Search by title
- [ ] Search by author
- [ ] Sort by title (A-Z)
- [ ] Sort by recently added
- [ ] Sort by recently opened
- [ ] Open book from grid
- [ ] Progress bar displays correctly
- [ ] "Recent" badge shows for opened books
- [ ] Refresh button re-scans
- [ ] Error handling for invalid directory
- [ ] Empty state displays correctly
- [ ] Cover images load properly
- [ ] Fallback placeholder shows when cover fails

### Test Data

Create test PDFs:
```bash
mkdir -p ~/Documents/TestLibrary
# Add various PDF files with different:
# - Filename lengths
# - Page counts
# - Metadata (title, author)
```

## Next Module: Reader

With the Library module complete, the next implementation is the **Reader Module**:

1. PDF.js integration for rendering
2. Dual-page spread layout
3. Basic page navigation
4. Keyboard shortcuts (Arrow keys)

Then advanced features:
- Page flip animations (CSS 3D)
- Fingerhold spring-back
- Rapid scanning slider
