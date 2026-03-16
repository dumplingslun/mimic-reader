<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useBookStore } from '../stores/bookStore'
import { useReaderStore } from '../stores/useReaderStore'
import { loadPDFDocument, renderPageToCanvas, renderPageAsImage, prefetchNearbyPages } from '../utils/pdf'
import type { PinnedPage } from '../types'
import PageFlip from './PageFlip.vue'

const bookStore = useBookStore()
const readerStore = useReaderStore()
const leftCanvasRef = ref<HTMLCanvasElement | null>(null)
const rightCanvasRef = ref<HTMLCanvasElement | null>(null)
const pageFlipRef = ref<InstanceType<typeof PageFlip> | null>(null)

const pdfDoc = ref<any>(null)
const currentPage = ref(1)
const isFlipping = ref(false)
const isSpringBack = ref(false)
let thumbnailWorker: Worker | null = null

const isRapidScanMode = computed(() => readerStore.isRapidScanMode)

const currentPageData = computed(() => ({
  left: currentPage.value,
  right: currentPage.value + 1
}))

const flipBackImage = ref<string | null>(null)

function getPagePreview(pageNumber: number): string | null {
  return readerStore.getCachedThumbnail(pageNumber) ?? null
}

async function loadBook() {
  if (!bookStore.currentBook || !leftCanvasRef.value || !rightCanvasRef.value) return
  
  try {
    pdfDoc.value = await loadPDFDocument(bookStore.currentBook.filePath)
    currentPage.value = bookStore.currentBook.currentPage
    await renderSpread()
    await startPrefetch()
  } catch (error) {
    console.error('Failed to load PDF:', error)
  }
}

async function renderSpread() {
  if (!pdfDoc.value || !leftCanvasRef.value || !rightCanvasRef.value) return
  
  const leftPage = currentPage.value
  const rightPage = currentPage.value + 1
  
  await Promise.all([
    renderPageToCanvas(pdfDoc.value, leftPage, leftCanvasRef.value),
    renderPageToCanvas(pdfDoc.value, rightPage, rightCanvasRef.value)
  ])
}

async function flipPage(direction: 'left' | 'right') {
  if (pageFlipRef.value) {
    pageFlipRef.value.flipPage(direction)
  }
}

async function handlePageChange(newPage: number) {
  currentPage.value = newPage
  bookStore.updateCurrentPage(newPage)
  await renderSpread()
  await startPrefetch()
}

function handleFlipStart(direction: 'left' | 'right') {
  isFlipping.value = true
  const backPage = direction === 'right' ? currentPage.value + 2 : currentPage.value - 1
  flipBackImage.value = getPagePreview(backPage)
}

function handleFlipEnd() {
  isFlipping.value = false
  flipBackImage.value = null
}

function goToPage(pageNumber: number) {
  if (!pdfDoc.value) return
  const maxPage = pdfDoc.value.numPages
  currentPage.value = Math.max(1, Math.min(pageNumber, maxPage - 1))
  bookStore.updateCurrentPage(currentPage.value)
  renderSpread()
  startPrefetch()
}

function handleReturnToHeldPage() {
  if (!bookStore.heldPage || !pdfDoc.value) return
  
  isSpringBack.value = true
  const targetPage = bookStore.heldPage
  const startPage = currentPage.value
  const duration = 400
  const startTime = performance.now()
  
  function animateSpring(currentTime: number) {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    
    const springProgress = easeOutBack(progress)
    currentPage.value = Math.round(startPage + (targetPage - startPage) * springProgress)
    
    if (progress < 1) {
      requestAnimationFrame(animateSpring)
    } else {
      currentPage.value = targetPage
      bookStore.updateCurrentPage(targetPage)
      isSpringBack.value = false
      renderSpread()
    }
  }
  
  requestAnimationFrame(animateSpring)
}

function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

async function handleFingerhold() {
  if (!bookStore.currentBook || !pdfDoc.value) return
  
  const pageNumber = currentPage.value
  
  try {
    const thumbnail = await renderPageAsImage(pdfDoc.value, pageNumber, 0.3)
    
    const pinnedPage: PinnedPage = {
      id: `${bookStore.currentBook.id}-${pageNumber}-${Date.now()}`,
      bookId: bookStore.currentBook.id,
      bookTitle: bookStore.currentBook.title,
      pageNumber,
      thumbnail,
      pinnedAt: Date.now()
    }
    
    readerStore.pinPage(pinnedPage)
    bookStore.holdPage(pageNumber)
  } catch (error) {
    console.error('Failed to generate thumbnail:', error)
  }
}

function handleReleaseHold() {
  bookStore.releaseHold()
}

async function startPrefetch() {
  if (!bookStore.currentBook || !pdfDoc.value) return

  readerStore.setPrefetchingState(true)

  try {
    const prefetched = await prefetchNearbyPages(pdfDoc.value, {
      currentPage: currentPage.value,
      totalPages: pdfDoc.value.numPages,
      range: 4,
      scale: 0.22
    })

    readerStore.cacheThumbnails(prefetched)
    readerStore.prunePrefetchCache(currentPage.value, 4)
  } finally {
    readerStore.setPrefetchingState(false)
  }
}

function initWorker() {
  thumbnailWorker = new Worker(new URL('../workers/thumbnailWorker.ts', import.meta.url), {
    type: 'module'
  })
  
  thumbnailWorker.onmessage = (event) => {
    const { type, thumbnail, pageNumber } = event.data
    
    if (type === 'prefetched') {
      readerStore.cacheThumbnail(pageNumber, thumbnail)
    }
  }
  
  thumbnailWorker.onerror = (error) => {
    console.error('Worker error:', error)
  }
}

function handleGoToPageEvent(e: Event) {
  const event = e as CustomEvent<number>
  if (typeof event.detail === 'number') {
    goToPage(event.detail)
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (bookStore.heldPage === null) {
      handleFingerhold()
    }
  }
  
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (bookStore.heldPage !== null) {
      handleReleaseHold()
    }
  }
}

onMounted(() => {
  loadBook()
  window.addEventListener('return-to-held-page', handleReturnToHeldPage)
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('go-to-page', handleGoToPageEvent as EventListener)
  initWorker()
})

onUnmounted(() => {
  window.removeEventListener('return-to-held-page', handleReturnToHeldPage)
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('go-to-page', handleGoToPageEvent as EventListener)
  if (thumbnailWorker) {
    thumbnailWorker.terminate()
  }
  readerStore.clearPrefetchCache()
})

watch(() => bookStore.currentBook, () => {
  loadBook()
})

defineExpose({
  goToPage,
  flipPage
})
</script>

<template>
  <div class="book-reader w-full h-full flex items-center justify-center p-8">
    <PageFlip
      ref="pageFlipRef"
      :current-page="currentPage"
      :total-pages="pdfDoc?.numPages || 1"
      :is-rapid-scan-mode="isRapidScanMode"
      @page-change="handlePageChange"
      @flip-start="handleFlipStart"
      @flip-end="handleFlipEnd"
    >
      <template #page-left="{ page }">
        <canvas ref="leftCanvasRef" class="page-canvas shadow-2xl" />
      </template>
      
      <template #page-right="{ page }">
        <canvas ref="rightCanvasRef" class="page-canvas shadow-2xl" />
      </template>
      
      <template #flip-page-front="{ page }">
        <canvas 
          v-if="page === currentPageData?.right || page === currentPageData?.left"
          :ref="page === currentPageData?.right ? 'rightCanvasRef' : 'leftCanvasRef'"
          class="page-canvas shadow-2xl"
        />
      </template>
      
      <template #flip-page-back="{ page, mirrored }">
        <div class="w-full h-full flex items-center justify-center bg-paper-50">
          <img
            v-if="flipBackImage"
            :src="flipBackImage"
            :alt="`Page ${page} preview`"
            class="prefetched-preview"
            :style="{ transform: mirrored ? 'scaleX(-1)' : 'none' }"
          />
          <span v-else class="text-gray-400 text-sm">Page {{ page }}</span>
        </div>
      </template>
    </PageFlip>
  </div>
</template>

<style scoped>
.page-canvas {
  width: 50vh;
  height: 70vh;
  object-fit: contain;
}

.prefetched-preview {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
