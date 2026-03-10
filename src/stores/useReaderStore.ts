import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { PinnedPage, ComparisonState } from '../types'
import { useWorkspacePersistence } from '../composables/useWorkspacePersistence'
import { useBookStore } from './bookStore'
import { renderPageAsImage } from '../utils/pdf'
import { loadPDFDocument } from '../utils/pdf'

export const useReaderStore = defineStore('reader', () => {
  const pinnedPages = ref<PinnedPage[]>([])
  const comparisonState = ref<ComparisonState>({
    isActive: false,
    pinnedPage: null,
    splitPosition: 'right'
  })
  
  const isPrefetching = ref(false)
  const prefetchedThumbnails = ref<Map<number, string>>(new Map())
  const isRapidScanMode = ref(false)
  const rapidScanCurrentPage = ref(1)
  const isRestoring = ref(false)

  const persistence = useWorkspacePersistence()
  const bookStore = useBookStore()

  const pinnedCount = computed(() => pinnedPages.value.length)
  
  const isComparisonActive = computed(() => comparisonState.value.isActive)

  async function regeneratePinnedThumbnail(bookFilePath: string, pageNumber: number): Promise<string | null> {
    try {
      const pdfDoc = await loadPDFDocument(bookFilePath)
      const thumbnail = await renderPageAsImage(pdfDoc, pageNumber, 0.3)
      return thumbnail
    } catch (error) {
      console.error(`Failed to regenerate thumbnail for page ${pageNumber}:`, error)
      return null
    }
  }

  async function pinPage(page: PinnedPage, skipPersistence = false) {
    const existing = pinnedPages.value.find(
      p => p.bookId === page.bookId && p.pageNumber === page.pageNumber
    )
    
    if (!existing) {
      pinnedPages.value.push(page)
      
      if (!skipPersistence && bookStore.currentBook) {
        await persistPinnedPages()
      }
    }
  }

  async function unpinPage(id: string, skipPersistence = false) {
    pinnedPages.value = pinnedPages.value.filter(p => p.id !== id)
    
    if (comparisonState.value.pinnedPage?.id === id) {
      closeComparison()
    }
    
    if (!skipPersistence && bookStore.currentBook) {
      await persistPinnedPages()
    }
  }

  function clearAllPinnedPages() {
    pinnedPages.value = []
    closeComparison()
  }

  function getPinnedPage(bookId: string, pageNumber: number): PinnedPage | undefined {
    return pinnedPages.value.find(
      p => p.bookId === bookId && p.pageNumber === pageNumber
    )
  }

  function openComparison(pinnedPage: PinnedPage, splitPosition: 'left' | 'right' = 'right') {
    comparisonState.value = {
      isActive: true,
      pinnedPage,
      splitPosition
    }
  }

  function closeComparison() {
    comparisonState.value = {
      isActive: false,
      pinnedPage: null,
      splitPosition: 'right'
    }
  }

  function toggleComparison(pinnedPage: PinnedPage) {
    if (comparisonState.value.pinnedPage?.id === pinnedPage.id) {
      closeComparison()
    } else {
      openComparison(pinnedPage)
    }
  }

  function setPrefetchingState(state: boolean) {
    isPrefetching.value = state
  }

  function cacheThumbnail(pageNumber: number, thumbnail: string) {
    prefetchedThumbnails.value.set(pageNumber, thumbnail)
  }

  function getCachedThumbnail(pageNumber: number): string | undefined {
    return prefetchedThumbnails.value.get(pageNumber)
  }

  function clearPrefetchCache() {
    prefetchedThumbnails.value.clear()
  }

  function enableRapidScanMode() {
    isRapidScanMode.value = true
  }

  function disableRapidScanMode() {
    isRapidScanMode.value = false
  }

  function toggleRapidScanMode() {
    isRapidScanMode.value = !isRapidScanMode.value
  }

  function setRapidScanCurrentPage(page: number) {
    rapidScanCurrentPage.value = page
  }

  async function persistPinnedPages() {
    if (!bookStore.currentBook || isRestoring.value) return

    const pinnedPageNumbers = pinnedPages.value
      .filter(p => p.bookId === bookStore.currentBook!.id)
      .map(p => p.pageNumber)

    const state = {
      lastPage: bookStore.currentBook.currentPage,
      pinnedPages: pinnedPageNumbers,
      layout: comparisonState.value.isActive ? 'split' : 'single' as 'single' | 'split'
    }

    persistence.debouncedSave(
      bookStore.currentBook.id,
      bookStore.currentBook.filePath,
      state,
      1000
    )
  }

  async function persistPageChange(pageNumber: number) {
    if (!bookStore.currentBook || isRestoring.value) return

    const pinnedPageNumbers = pinnedPages.value
      .filter(p => p.bookId === bookStore.currentBook!.id)
      .map(p => p.pageNumber)

    const state = {
      lastPage: pageNumber,
      pinnedPages: pinnedPageNumbers,
      layout: comparisonState.value.isActive ? 'split' : 'single' as 'single' | 'split'
    }

    persistence.debouncedSave(
      bookStore.currentBook.id,
      bookStore.currentBook.filePath,
      state,
      1000
    )
  }

  async function restorePinnedPages(bookFilePath: string, pageNumbers: number[]) {
    isRestoring.value = true

    const restoredPages: PinnedPage[] = []

    for (const pageNumber of pageNumbers) {
      const thumbnail = await regeneratePinnedThumbnail(bookFilePath, pageNumber)
      
      if (thumbnail && bookStore.currentBook) {
        const pinnedPage: PinnedPage = {
          id: `${bookStore.currentBook.id}-${pageNumber}-${Date.now()}`,
          bookId: bookStore.currentBook.id,
          bookTitle: bookStore.currentBook.title,
          pageNumber,
          thumbnail,
          pinnedAt: Date.now()
        }
        restoredPages.push(pinnedPage)
      }
    }

    pinnedPages.value = [...pinnedPages.value, ...restoredPages]
    isRestoring.value = false
  }

  async function restoreWorkspaceState() {
    if (!bookStore.currentBook) return null

    const state = await persistence.restoreWorkspace(bookStore.currentBook)
    
    if (state) {
      isRestoring.value = true
      
      if (state.pinnedPages.length > 0) {
        await restorePinnedPages(bookStore.currentBook.filePath, state.pinnedPages)
      }
      
      if (state.layout === 'split' && pinnedPages.value.length > 0) {
        openComparison(pinnedPages.value[0])
      }
      
      isRestoring.value = false
      
      return {
        restoredPage: state.restoredPage,
        layout: state.layout
      }
    }
    
    return null
  }

  function cancelPendingPersistence() {
    if (bookStore.currentBook) {
      persistence.cancelPendingSave(
        bookStore.currentBook.id,
        bookStore.currentBook.filePath
      )
    }
  }

  return {
    pinnedPages,
    comparisonState,
    isPrefetching,
    prefetchedThumbnails,
    isRapidScanMode,
    rapidScanCurrentPage,
    isRestoring,
    pinnedCount,
    isComparisonActive,
    pinPage,
    unpinPage,
    clearAllPinnedPages,
    getPinnedPage,
    openComparison,
    closeComparison,
    toggleComparison,
    setPrefetchingState,
    cacheThumbnail,
    getCachedThumbnail,
    clearPrefetchCache,
    enableRapidScanMode,
    disableRapidScanMode,
    toggleRapidScanMode,
    setRapidScanCurrentPage,
    persistPinnedPages,
    persistPageChange,
    restorePinnedPages,
    restoreWorkspaceState,
    cancelPendingPersistence
  }
})
