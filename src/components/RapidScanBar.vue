<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useVelocity } from '../composables/useVelocity'
import { useBookStore } from '../stores/bookStore'
import { useReaderStore } from '../stores/useReaderStore'

interface Props {
  totalPages: number
  currentPage: number
  visible: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'page-change': [page: number]
  'navigate': [page: number]
  'close': []
}>()

const bookStore = useBookStore()
const readerStore = useReaderStore()

const THUMBNAIL_WIDTH = 100
const THUMBNAIL_HEIGHT = 140
const VISIBLE_THRESHOLD = 5
const BATCH_SIZE = 50

const containerRef = ref<HTMLDivElement | null>(null)
const thumbnails = ref<Map<number, string>>(new Map())
const loadingPages = ref<Set<number>>(new Set())

const { 
  velocity, 
  position, 
  speed, 
  isMoving, 
  direction,
  isFast,
  startMoving, 
  stopMoving, 
  stop,
  setPosition,
  startAnimationLoop,
  stopAnimationLoop
} = useVelocity({
  acceleration: 0.8,
  friction: 0.96,
  maxVelocity: 80,
  stopThreshold: 0.1
})

const totalWidth = computed(() => props.totalPages * THUMBNAIL_WIDTH)

const viewportStart = computed(() => {
  return Math.max(0, Math.floor(position.value / THUMBNAIL_WIDTH) - VISIBLE_THRESHOLD)
})

const viewportEnd = computed(() => {
  const viewportWidth = containerRef.value?.clientWidth || 800
  const visibleCount = Math.ceil(viewportWidth / THUMBNAIL_WIDTH)
  return Math.min(
    props.totalPages - 1,
    Math.ceil(position.value / THUMBNAIL_WIDTH) + visibleCount + VISIBLE_THRESHOLD
  )
})

const visiblePages = computed(() => {
  const pages: number[] = []
  for (let i = viewportStart.value; i <= viewportEnd.value; i++) {
    pages.push(i + 1)
  }
  return pages
})

const currentPageIndex = computed(() => props.currentPage - 1)

let thumbnailWorker: Worker | null = null
let velocityUpdateCallback: ((pos: number, vel: number) => void) | null = null

function initWorker() {
  thumbnailWorker = new Worker(new URL('../workers/thumbnailWorker.ts', import.meta.url), {
    type: 'module'
  })
  
  thumbnailWorker.onmessage = (event) => {
    const { type, thumbnail, pageNumber, pageRange } = event.data
    
    if (type === 'batch-thumbnail') {
      thumbnails.value.set(pageNumber, thumbnail)
      loadingPages.value.delete(pageNumber)
    } else if (type === 'batch-complete') {
      console.log(`Batch complete: ${pageRange.start}-${pageRange.end}`)
    } else if (type === 'error' || type === 'batch-error') {
      console.error(`Worker error for page ${pageNumber}:`, event.data.error)
      loadingPages.value.delete(pageNumber)
    }
  }
}

function loadBatch(startPage: number, endPage: number) {
  if (!bookStore.currentBook || !thumbnailWorker) return
  
  for (let page = startPage; page <= endPage; page++) {
    if (!thumbnails.value.has(page) && !loadingPages.value.has(page)) {
      loadingPages.value.add(page)
    }
  }
  
  thumbnailWorker.postMessage({
    type: 'batch',
    filePath: bookStore.currentBook.filePath,
    pageRange: { start: startPage, end: endPage },
    scale: 0.15
  })
}

function handleVelocityUpdate(pos: number, vel: number) {
  const page = Math.round(pos / THUMBNAIL_WIDTH) + 1
  const clampedPage = Math.max(1, Math.min(props.totalPages, page))
  
  emit('page-change', clampedPage)
  
  const newStart = Math.max(1, viewportStart.value + 1)
  const newEnd = Math.min(props.totalPages, viewportEnd.value + 1)
  
  if (vel > 0) {
    loadBatch(newEnd - BATCH_SIZE, newEnd)
  } else if (vel < 0) {
    loadBatch(newStart, newStart + BATCH_SIZE)
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.visible) return
  
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault()
    const dir = e.key === 'ArrowLeft' ? 'left' : 'right'
    
    if (!isMoving.value) {
      startMoving(dir)
      startAnimationLoop(handleVelocityUpdate)
    } else if (direction.value !== dir) {
      velocity.value = -velocity.value * 0.5
      direction.value = dir
    }
  }
  
  if (e.key === 'Escape') {
    emit('close')
  }
}

function handleKeyup(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    stopMoving()
  }
}

function handleWheel(e: WheelEvent) {
  if (!props.visible) return
  e.preventDefault()
  
  const delta = e.deltaX || e.deltaY
  position.value += delta * 2
  
  const page = Math.round(position.value / THUMBNAIL_WIDTH) + 1
  const clampedPage = Math.max(1, Math.min(props.totalPages, page))
  emit('page-change', clampedPage)
}

function handleThumbnailClick(page: number) {
  stop()
  emit('navigate', page)
}

function scrollToPage(page: number) {
  const targetPos = (page - 1) * THUMBNAIL_WIDTH
  setPosition(targetPos)
}

watch(() => props.currentPage, (newPage) => {
  if (!isMoving.value && speed.value < 1) {
    scrollToPage(newPage)
  }
})

watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    scrollToPage(props.currentPage)
    loadBatch(1, Math.min(BATCH_SIZE, props.totalPages))
    window.addEventListener('keydown', handleKeydown)
    window.addEventListener('keyup', handleKeyup)
  } else {
    stop()
    stopAnimationLoop()
    window.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('keyup', handleKeyup)
  }
}, { immediate: true })

onMounted(() => {
  initWorker()
  
  if (containerRef.value) {
    containerRef.value.addEventListener('wheel', handleWheel, { passive: false })
  }
})

onUnmounted(() => {
  stop()
  stopAnimationLoop()
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('keyup', handleKeyup)
  
  if (containerRef.value) {
    containerRef.value.removeEventListener('wheel', handleWheel)
  }
  
  if (thumbnailWorker) {
    thumbnailWorker.terminate()
  }
})

defineExpose({
  scrollToPage,
  stop
})
</script>

<template>
  <Transition name="slide-up">
    <div v-if="visible" class="rapid-scan-bar-container">
      <div class="scan-bar-header">
        <span class="page-indicator">
          Page {{ currentPage }} / {{ totalPages }}
          <span v-if="isFast" class="speed-indicator">
            {{ Math.round(speed) }} px/f
          </span>
        </span>
        <button class="close-btn" @click="$emit('close')">
          ×
        </button>
      </div>
      
      <div ref="containerRef" class="thumbnails-viewport">
        <div 
          class="thumbnails-track"
          :style="{ 
            width: `${totalWidth}px`,
            transform: `translateX(${-position}px)`
          }"
        >
          <div
            v-for="page in visiblePages"
            :key="page"
            class="thumbnail-wrapper"
            :style="{ 
              width: `${THUMBNAIL_WIDTH}px`,
              height: `${THUMBNAIL_HEIGHT}px`
            }"
            @click="handleThumbnailClick(page)"
          >
            <div 
              class="thumbnail-item"
              :class="{ 
                'current-page': page === currentPage,
                'motion-blur': isFast && speed > 20
              }"
            >
              <img
                v-if="thumbnails.has(page)"
                :src="thumbnails.get(page)"
                :alt="`Page ${page}`"
                class="thumbnail-image"
                draggable="false"
              />
              <div v-else class="thumbnail-placeholder">
                <span>{{ page }}</span>
              </div>
              
              <div class="page-number-overlay">
                {{ page }}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="scan-bar-footer">
        <div class="velocity-indicator">
          <div 
            class="velocity-bar"
            :style="{ 
              width: `${Math.min(100, (speed / 80) * 100)}%`,
              opacity: speed > 0 ? 1 : 0
            }"
          />
        </div>
        <span class="hint">
          <kbd>←</kbd> <kbd>→</kbd> Navigate · <kbd>Esc</kbd> Close · Click to jump
        </span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.rapid-scan-bar-container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(15, 15, 15, 0.98);
  backdrop-filter: blur(12px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.scan-bar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.page-indicator {
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 12px;
}

.speed-indicator {
  color: rgba(59, 130, 246, 0.9);
  font-size: 11px;
  font-weight: 700;
  animation: pulse 0.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.close-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.9);
  color: white;
  border: none;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(239, 68, 68, 1);
  transform: scale(1.1);
}

.thumbnails-viewport {
  height: 160px;
  overflow: hidden;
  position: relative;
  cursor: grab;
}

.thumbnails-viewport:active {
  cursor: grabbing;
}

.thumbnails-track {
  position: absolute;
  height: 100%;
  display: flex;
  align-items: center;
  will-change: transform;
}

.thumbnail-wrapper {
  flex-shrink: 0;
  padding: 8px 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.thumbnail-wrapper:hover {
  transform: scale(1.05);
}

.thumbnail-item {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid transparent;
  transition: all 0.2s ease;
}

.thumbnail-item.current-page {
  border-color: rgba(59, 130, 246, 0.9);
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
}

.thumbnail-item.motion-blur {
  filter: blurX(8px);
  transform: scaleX(0.9);
}

@keyframes motionBlur {
  0% { filter: blurX(0px); }
  50% { filter: blurX(12px); }
  100% { filter: blurX(0px); }
}

.thumbnail-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.2);
  font-size: 24px;
  font-weight: 700;
}

.page-number-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.9));
  color: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  font-weight: 600;
  padding: 4px;
  text-align: center;
}

.scan-bar-footer {
  padding: 8px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  gap: 12px;
}

.velocity-indicator {
  width: 100px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.velocity-bar {
  height: 100%;
  background: linear-gradient(90deg, 
    rgba(59, 130, 246, 0.8) 0%, 
    rgba(147, 51, 234, 0.8) 50%, 
    rgba(239, 68, 68, 0.8) 100%
  );
  transition: width 0.1s ease;
}

.hint {
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.hint kbd {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 10px;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-enter-from {
  transform: translateY(100%);
  opacity: 0;
}

.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
