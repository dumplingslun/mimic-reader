export interface Book {
  id: string
  title: string
  filePath: string
  coverPath: string
  author?: string
  totalPages: number
  currentPage: number
  addedAt: number
  lastOpened?: number
  fileSize?: number
  fileHash?: string
}

export interface PageRenderOptions {
  pageNumber: number
  scale?: number
  viewport?: number
}

export interface FlipAnimationOptions {
  direction: 'left' | 'right'
  duration?: number
  easing?: string
}

export interface LibraryStats {
  totalBooks: number
  totalPages: number
  totalSize: number
  lastScanned?: number
}

export interface PinnedPage {
  id: string
  bookId: string
  bookTitle: string
  pageNumber: number
  thumbnail: string
  pinnedAt: number
}

export interface ComparisonState {
  isActive: boolean
  pinnedPage: PinnedPage | null
  splitPosition: 'left' | 'right'
}
