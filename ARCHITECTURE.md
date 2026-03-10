# MimicReader Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Vue 3)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Library   │  │   Reader    │  │   PDF Renderer      │ │
│  │     View    │  │   View      │  │   (PDF.js)          │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│         │                │                    │             │
│         └────────────────┼────────────────────┘             │
│                          │                                  │
│                  ┌───────▼───────┐                          │
│                  │  Pinia Store  │                          │
│                  │  (State Mgmt) │                          │
│                  └───────┬───────┘                          │
└──────────────────────────┼──────────────────────────────────┘
                           │ Tauri IPC (invoke)
┌──────────────────────────▼──────────────────────────────────┐
│                   Backend (Tauri/Rust)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Library   │  │   PDF       │  │   File System       │ │
│  │   Manager   │  │  Handler    │  │   Operations        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│         │                │                    │             │
│         └────────────────┼────────────────────┘             │
│                          │                                  │
│                  ┌───────▼───────┐                          │
│                  │  Local File   │                          │
│                  │    System     │                          │
│                  └───────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

## Core Modules

### 1. Library Module (书库系统)

**Frontend (`src/views/LibraryView.vue`, `src/components/BookCard.vue`)**
- Grid/bookshelf display of books
- Cover image display
- Book metadata (title, page count)

**Backend (`src-tauri/src/library.rs`)**
- `LibraryManager`: Manages book collection
- Scans directory for PDF files recursively
- Extracts PDF metadata (page count)
- Generates cover images from first page

**Data Flow:**
```
User opens app → Frontend calls `get_library` → 
Rust scans PDF directory → Returns Book[] → 
Vue renders book grid
```

### 2. Reader Module (阅读系统)

**Frontend (`src/views/ReaderView.vue`, `src/components/BookReader.vue`)**
- Dual-page spread rendering
- Page flip animations (CSS 3D transforms)
- Keyboard navigation (Arrow keys)
- Touch/click zones for page turning

**Backend (`src-tauri/src/pdf_handler.rs`)**
- `read_pdf_file()`: Loads PDF as ArrayBuffer
- `extract_cover()`: Generates cover thumbnails

**PDF Rendering:**
```
BookReader component → Calls `read_pdf_file` via Tauri →
PDF.js loads document → Renders to Canvas →
Left/Right page canvases for spread view
```

### 3. Page Flip Animation System

**Implementation Approach:**
- CSS 3D transforms with `perspective` and `rotateY`
- Two-page spread with independent transform control
- Custom easing functions for realistic paper motion

**Animation States:**
```
IDLE → FLIP_START → FLIP_MID (180° rotation) → FLIP_END → IDLE
```

**Key CSS Properties:**
```css
transform-style: preserve-3d;
perspective: 2000px;
transform-origin: left/right center;
backface-visibility: hidden;
```

### 4. Fingerhold Feature (夹页功能)

**Purpose:** Temporarily bookmark a page (like keeping a finger in a physical book)

**State Management:**
```typescript
// Pinia Store
heldPage: ref<number | null>(null)
```

**User Flow:**
1. User clicks "Hold Page" button → `heldPage = currentPage`
2. User navigates to other pages (index, appendix)
3. User clicks "Return" button → Spring-back animation to held page

**Spring-Back Animation:**
- Uses `easeOutBack` easing for overshoot effect
- 400ms duration (faster than normal flip)
- Simulates physical "snap back" of releasing a held page

```typescript
function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
```

### 5. Rapid Scanning (速览翻页)

**Implementation:**
- Slider control for quick page navigation
- Low-resolution preview rendering during rapid flip
- Debounced page rendering to prevent overload

**User Interaction:**
```
Slider drag → Update page number → 
Throttled render → Show preview →
Slider release → Final page render
```

## Tauri IPC Bridge

### Commands (Rust → Vue)

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `get_library` | none | `Book[]` | Get all books in library |
| `scan_library` | `directory: String` | `Book[]` | Scan new directory for PDFs |
| `extract_cover` | `file_path: String` | `String` | Get cover as base64 data URL |
| `read_pdf_file` | `file_path: String` | `Uint8Array` | Read PDF file as bytes |

### Usage Example (Vue)
```typescript
import { invoke } from '@tauri-apps/api'

const books = await invoke<Book[]>('get_library')
const coverData = await invoke<string>('extract_cover', { filePath: '/path/to/book.pdf' })
const pdfBytes = await invoke<Uint8Array>('read_pdf_file', { filePath: '/path/to/book.pdf' })
```

## Project Structure

```
mimic-reader/
├── src/                          # Frontend (Vue 3)
│   ├── components/
│   │   ├── BookCard.vue          # Library book display
│   │   ├── BookReader.vue        # PDF reader with animations
│   │   └── ReaderControls.vue    # Reader UI controls
│   ├── views/
│   │   ├── LibraryView.vue       # Library grid view
│   │   └── ReaderView.vue        # Full-screen reader
│   ├── stores/
│   │   └── bookStore.ts          # Pinia state management
│   ├── utils/
│   │   └── pdf.ts                # PDF.js utilities
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces
│   └── styles/
│       └── main.css              # Global styles + Tailwind
├── src-tauri/                    # Backend (Rust)
│   ├── src/
│   │   ├── main.rs               # Tauri app entry
│   │   ├── library.rs            # Library management
│   │   └── pdf_handler.rs        # PDF operations
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # Tauri configuration
├── package.json                  # Node.js dependencies
├── vite.config.ts                # Vite build config
├── tailwind.config.js            # Tailwind CSS config
└── tsconfig.json                 # TypeScript config
```

## Key Technical Decisions

1. **PDF.js for Rendering**: Cross-platform, well-maintained, good performance for scanned PDFs

2. **CSS 3D Transforms for Page Flip**: 
   - Pros: GPU-accelerated, smooth 60fps, no WebGL complexity
   - Cons: Less realistic than WebGL shader-based curl

3. **Pinia for State Management**: Official Vue 3 store, TypeScript-first, simpler than Vuex

4. **Rust `pdf` Crate**: Native PDF parsing for metadata extraction, faster than JS alternatives

5. **Base64 Cover Images**: Simple data transfer between Rust and Vue, no file I/O overhead

## Next Steps

1. **Install Rust** (required for Tauri)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run Development Server**
   ```bash
   npm run tauri dev
   ```

4. **Implementation Priority**
   - ✅ Project scaffolding
   - ✅ Architecture design
   - ⏳ Library module (scan PDFs, display grid)
   - ⏳ Reader module (PDF rendering, basic navigation)
   - ⏳ Page flip animations
   - ⏳ Fingerhold feature
   - ⏳ Rapid scanning slider
