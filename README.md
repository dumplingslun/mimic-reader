# MimicReader - Library Module Implementation

A desktop PDF reader optimized for scanned PDFs with realistic page-turning experience.

## 📚 Library Module Features

### Implemented

1. **PDF Library Scanning**
   - Recursive directory scanning for PDF files
   - Intelligent caching to avoid re-scanning unchanged files
   - Parallel PDF metadata extraction

2. **Book Metadata Extraction**
   - Title from filename and PDF metadata
   - Author extraction from PDF info dictionary
   - Page count from PDF structure
   - File size and hash for change detection

3. **Cover Generation**
   - First page rendering to JPEG thumbnail
   - Fallback to styled SVG placeholder with title
   - Cover caching in local data directory

4. **Library Persistence**
   - JSON cache file for fast library loading
   - Incremental updates (only process new/changed files)
   - Last opened tracking

5. **Search & Filter**
   - Real-time title/author search
   - Sort by: Recently Added, Title (A-Z), Recently Opened
   - Custom directory scanning

6. **Progress Tracking**
   - Current page persistence
   - Reading progress visualization
   - Recent books quick access

## 🛠️ Setup Instructions

### Prerequisites

1. **Install Rust** (if not already installed)
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. **Install System Dependencies** (Linux)
```bash
# Ubuntu/Debian
sudo apt-get install -y \
  libwebkit2gtk-4.0-dev \
  libgtk-3-dev \
  libjavascriptcoregtk-4.0-dev \
  libsoup2.4-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libgdk-pixbuf2.0-dev \
  libpango1.0-dev \
  libcairo2-dev

# Fedora
sudo dnf install -y \
  webkit2gtk3-devel \
  gtk3-devel \
  javascriptcoregtk4.0-devel \
  libsoup2.4-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel

# Arch Linux
sudo pacman -S --needed \
  webkit2gtk \
  gtk3 \
  javascriptcoregtk-4.0 \
  libsoup2.4 \
  libappindicator-gtk3 \
  librsvg
```

3. **Install Node.js Dependencies**
```bash
cd mimic-reader
npm install
```

### Development

```bash
# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## 📁 Project Structure

```
mimic-reader/
├── src/                          # Vue 3 Frontend
│   ├── components/
│   │   ├── BookCard.vue          # Library book display card
│   │   ├── BookReader.vue        # PDF reader with page flip
│   │   └── ReaderControls.vue    # Reader UI controls
│   ├── views/
│   │   ├── LibraryView.vue       # Main library view
│   │   └── ReaderView.vue        # Full-screen reader
│   ├── stores/
│   │   └── bookStore.ts          # Pinia state management
│   ├── utils/
│   │   └── pdf.ts                # PDF.js utilities
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces
│   └── styles/
│       └── main.css              # Global styles
├── src-tauri/                    # Rust Backend
│   ├── src/
│   │   ├── main.rs               # Tauri commands
│   │   ├── library.rs            # Library management
│   │   └── pdf_handler.rs        # PDF operations
│   ├── Cargo.toml
│   └── tauri.conf.json
└── package.json
```

## 🔧 Tauri Commands

### Library Management

```typescript
// Get all books in library
const books = await invoke<Book[]>('get_library')

// Scan directory for PDFs
const books = await invoke<Book[]>('scan_library', { 
  directory: '/path/to/pdfs' 
})

// Search books by title/author
const results = await invoke<Book[]>('search_library', { 
  query: 'search term' 
})

// Get book cover image
const coverData = await invoke<string>('get_book_cover', { 
  bookId: 'uuid' 
})

// Update reading progress
await invoke('update_book_page', { 
  bookId: 'uuid', 
  page: 42 
})
```

### PDF Operations

```typescript
// Read PDF file as bytes (for PDF.js)
const pdfBytes = await invoke<Uint8Array>('read_pdf_file_command', { 
  filePath: '/path/to/book.pdf' 
})

// Get PDF metadata
const metadata = await invoke<PdfMetadata>('get_pdf_metadata_command', { 
  filePath: '/path/to/book.pdf' 
})
// Returns: { num_pages: number, title?: string, author?: string }

// Extract cover image
const cover = await invoke<string>('extract_cover_command', { 
  filePath: '/path/to/book.pdf' 
})
// Returns: data:image/jpeg;base64,...
```

## 📖 Library Data Model

```typescript
interface Book {
  id: string           // UUID
  title: string        // Book title
  filePath: string     // Absolute path to PDF
  coverPath: string    // Base64 cover image data URL
  author?: string      // Author name (from PDF metadata)
  totalPages: number   // Total pages in PDF
  currentPage: number  // Current reading position
  addedAt: number      // Unix timestamp when added
  lastOpened?: number  // Unix timestamp of last open
  fileSize?: number    // File size in bytes
  fileHash?: string    // Hash for change detection
}
```

## 🎨 Library View Features

### Search Bar
- Real-time filtering by title or author
- Clear button to reset to full library

### Sort Options
- **Recently Added**: Sort by scan/import date
- **Title (A-Z)**: Alphabetical order
- **Recently Opened**: Sort by last opened timestamp

### Book Cards
- Cover image with hover zoom effect
- Progress bar showing reading position
- "Recent" badge for recently opened books
- Page count and add date display

### Directory Scanning
- Default: Scans `~/Documents` on first run
- Custom: User can specify any directory
- Recursive: Finds PDFs in subdirectories

## 🚀 Performance Optimizations

1. **Library Caching**
   - `library_cache.json` stores book metadata
   - Only re-scans changed/new files
   - Fast startup after first scan

2. **Cover Caching**
   - Generated covers stored in local data dir
   - Base64 caching in memory during session
   - Lazy loading for book grid

3. **Incremental Updates**
   - File hash comparison
   - Skip unchanged PDFs
   - Background scanning

## 📝 Next Steps

The Library module is complete. Next modules to implement:

1. **Reader Module** - PDF rendering with PDF.js
2. **Page Flip Animation** - CSS 3D transforms for realistic turning
3. **Fingerhold Feature** - Spring-back page bookmarking
4. **Rapid Scanning** - Low-res preview slider

## 🐛 Troubleshooting

### "Failed to load library"
- Ensure PDF directory exists and contains `.pdf` files
- Check file permissions
- Review Rust backend logs in terminal

### "Cover not loading"
- Some PDFs may have rendering issues
- Fallback placeholder should display
- Check browser console for errors

### Tauri build fails
- Install all system dependencies (see above)
- Run `cargo clean` in `src-tauri/`
- Ensure Rust is up to date: `rustup update`

## 📄 License

MIT License - See LICENSE file for details
