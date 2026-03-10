import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import type { Book } from '../types'
import { useReaderStore } from './useReaderStore'

export const useBookStore = defineStore('book', () => {
  const readerStore = useReaderStore()
  const books = ref<Book[]>([])
  const currentBook = ref<Book | null>(null)
  const isLoading = ref(false)
  const isScanning = ref(false)
  const error = ref<string | null>(null)

  const heldPage = ref<number | null>(null)
  const heldPageSnapshot = ref<Book | null>(null)

  const bookCount = computed(() => books.value.length)
  
  const recentBooks = computed(() => {
    return [...books.value]
      .filter(b => b.lastOpened !== null)
      .sort((a, b) => (b.lastOpened || 0) - (a.lastOpened || 0))
      .slice(0, 5)
  })

  async function loadLibrary() {
    isLoading.value = true
    error.value = null
    
    try {
      const result = await invoke<Book[]>('get_library')
      books.value = result
      
      for (const book of books.value) {
        try {
          const coverData = await invoke<string>('get_book_cover', { bookId: book.id })
          book.coverPath = coverData
        } catch (e) {
          console.error(`Failed to load cover for ${book.title}:`, e)
        }
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load library'
      console.error('Failed to load library:', e)
    } finally {
      isLoading.value = false
    }
  }

  async function scanDirectory(directory: string) {
    isScanning.value = true
    error.value = null
    
    try {
      const result = await invoke<Book[]>('scan_library', { directory })
      books.value = result
      
      for (const book of books.value) {
        try {
          const coverData = await invoke<string>('get_book_cover', { bookId: book.id })
          book.coverPath = coverData
        } catch (e) {
          console.error(`Failed to load cover for ${book.title}:`, e)
        }
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to scan directory'
      console.error('Failed to scan directory:', e)
    } finally {
      isScanning.value = false
    }
  }

  async function searchBooks(query: string) {
    if (!query.trim()) {
      await loadLibrary()
      return
    }
    
    try {
      const result = await invoke<Book[]>('search_library', { query })
      books.value = result
    } catch (e) {
      console.error('Search failed:', e)
    }
  }

  async function openBook(book: Book) {
    currentBook.value = { ...book }
    heldPage.value = null
    heldPageSnapshot.value = null
    
    const restoredState = await readerStore.restoreWorkspaceState()
    
    if (restoredState && restoredState.restoredPage !== book.currentPage) {
      currentBook.value.currentPage = restoredState.restoredPage
    }
  }

  function closeBook() {
    if (currentBook.value) {
      updateBookProgress(currentBook.value.id, currentBook.value.currentPage)
      readerStore.cancelPendingPersistence()
    }
    currentBook.value = null
    heldPage.value = null
    heldPageSnapshot.value = null
  }

  function updateCurrentPage(pageNumber: number) {
    if (currentBook.value) {
      currentBook.value.currentPage = pageNumber
      
      const bookInLibrary = books.value.find(b => b.id === currentBook.value?.id)
      if (bookInLibrary) {
        bookInLibrary.currentPage = pageNumber
      }
      
      readerStore.persistPageChange(pageNumber)
    }
  }

  async function updateBookProgress(bookId: string, page: number) {
    try {
      await invoke('update_book_page', { bookId, page })
      
      const book = books.value.find(b => b.id === bookId)
      if (book) {
        book.currentPage = page
        book.lastOpened = Math.floor(Date.now() / 1000)
      }
    } catch (e) {
      console.error('Failed to update book progress:', e)
    }
  }

  function holdPage(pageNumber: number) {
    heldPage.value = pageNumber
    if (currentBook.value) {
      heldPageSnapshot.value = { ...currentBook.value }
    }
  }

  function releaseHold() {
    heldPage.value = null
    heldPageSnapshot.value = null
  }

  function returnToHeldPage() {
    if (heldPage.value !== null && currentBook.value) {
      const targetPage = heldPage.value
      updateCurrentPage(targetPage)
      
      window.dispatchEvent(new CustomEvent('return-to-held-page', {
        detail: { targetPage }
      }))
      
      releaseHold()
    }
  }

  function getBookById(id: string): Book | undefined {
    return books.value.find(b => b.id === id)
  }

  return {
    books,
    currentBook,
    isLoading,
    isScanning,
    error,
    heldPage,
    heldPageSnapshot,
    bookCount,
    recentBooks,
    loadLibrary,
    scanDirectory,
    searchBooks,
    openBook,
    closeBook,
    updateCurrentPage,
    updateBookProgress,
    holdPage,
    releaseHold,
    returnToHeldPage,
    getBookById
  }
})
