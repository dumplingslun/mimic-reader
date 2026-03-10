<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useBookStore } from '../stores/bookStore'
import { useReaderStore } from '../stores/useReaderStore'
import BookReader from '../components/BookReader.vue'
import ReaderControls from '../components/ReaderControls.vue'
import FloatingStrips from '../components/FloatingStrips.vue'
import MiniReader from '../components/MiniReader.vue'
import RapidScanBar from '../components/RapidScanBar.vue'

const bookStore = useBookStore()
const readerStore = useReaderStore()
const showControls = ref(true)
let hideControlsTimeout: number | null = null

const isComparisonActive = computed(() => readerStore.isComparisonActive)
const comparisonPinnedPage = computed(() => readerStore.comparisonState.pinnedPage)
const splitPosition = computed(() => readerStore.comparisonState.splitPosition)
const isRapidScanMode = computed(() => readerStore.isRapidScanMode)

const mainReaderWidth = computed(() => {
  return isComparisonActive.value ? '50%' : '100%'
})

const bookReaderRef = ref<InstanceType<typeof BookReader> | null>(null)

function handleMouseMove() {
  showControls.value = true
  
  if (hideControlsTimeout) {
    clearTimeout(hideControlsTimeout)
  }
  
  hideControlsTimeout = window.setTimeout(() => {
    if (!isInteracting.value) {
      showControls.value = false
    }
  }, 2000)
}

const isInteracting = ref(false)

function handleInteractionStart() {
  isInteracting.value = true
}

function handleInteractionEnd() {
  isInteracting.value = false
  if (!showControls.value) {
    hideControlsTimeout = window.setTimeout(() => {
      showControls.value = false
    }, 2000)
  }
}

function handleCloseComparison() {
  readerStore.closeComparison()
}

function handleRapidScanPageChange(page: number) {
  readerStore.setRapidScanCurrentPage(page)
  bookStore.updateCurrentPage(page)
}

function handleRapidScanNavigate(page: number) {
  bookStore.updateCurrentPage(page)
  readerStore.disableRapidScanMode()
  
  if (bookReaderRef.value) {
    bookReaderRef.value.goToPage(page)
  }
}

function handleRapidScanClose() {
  readerStore.disableRapidScanMode()
}

function handleClose() {
  bookStore.closeBook()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === ' ' && !e.shiftKey) {
    e.preventDefault()
    readerStore.toggleRapidScanMode()
  }
}

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('keydown', handleKeydown)
  if (hideControlsTimeout) {
    clearTimeout(hideControlsTimeout)
  }
})
</script>

<template>
  <div 
    class="reader-container relative w-full h-full bg-black"
    @mousemove="handleMouseMove"
    @mousedown="handleInteractionStart"
    @mouseup="handleInteractionEnd"
    @touchstart="handleInteractionStart"
    @touchend="handleInteractionEnd"
  >
    <div class="reader-content flex h-full" :style="{ width: mainReaderWidth }">
      <div class="main-reader flex-1 h-full relative">
        <BookReader v-if="bookStore.currentBook" ref="bookReaderRef" />
        
        <ReaderControls 
          v-show="showControls"
          @close="handleClose"
          @toggle-fingerhold="bookStore.heldPage !== null ? bookStore.releaseHold() : bookStore.holdPage(bookStore.currentBook?.currentPage || 1)"
          @return-held="bookStore.returnToHeldPage()"
          :held-page="bookStore.heldPage"
        />
      </div>
      
      <Transition name="comparison-slide">
        <MiniReader
          v-if="isComparisonActive && comparisonPinnedPage"
          :pinned-page="comparisonPinnedPage"
          :is-comparing="isComparisonActive"
          @close="handleCloseComparison"
        />
      </Transition>
    </div>
    
    <FloatingStrips />
    
    <RapidScanBar
      v-if="bookStore.currentBook"
      :total-pages="bookStore.currentBook.totalPages"
      :current-page="bookStore.currentBook.currentPage"
      :visible="isRapidScanMode"
      @page-change="handleRapidScanPageChange"
      @navigate="handleRapidScanNavigate"
      @close="handleRapidScanClose"
    />
  </div>
</template>

<style scoped>
.reader-container {
  overflow: hidden;
}

.reader-content {
  transition: width 0.3s ease;
}

.main-reader {
  transition: width 0.3s ease;
}

.comparison-slide-enter-active,
.comparison-slide-leave-active {
  transition: all 0.3s ease;
}

.comparison-slide-enter-from {
  opacity: 0;
  transform: translateX(100%);
  width: 0;
}

.comparison-slide-leave-to {
  opacity: 0;
  transform: translateX(100%);
  width: 0;
}
</style>
