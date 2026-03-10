<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useReaderStore } from '../stores/useReaderStore'
import { useBookStore } from '../stores/bookStore'
import type { PinnedPage } from '../types'

interface PageFlipProps {
  currentPage: number
  totalPages: number
  isRapidScanMode?: boolean
}

const props = withDefaults(defineProps<PageFlipProps>(), {
  isRapidScanMode: false
})

const emit = defineEmits<{
  'page-change': [page: number]
  'flip-start': []
  'flip-end': []
}>()

const readerStore = useReaderStore()
const bookStore = useBookStore()

const isFlipping = ref(false)
const flipDirection = ref<'left' | 'right' | null>(null)
const flipProgress = ref(0)
const activeFlipPage = ref<number | null>(null)

const FLIP_DURATION = 600
const PERSPECTIVE = 2000

const canFlipLeft = computed(() => props.currentPage > 1)
const canFlipRight = computed(() => props.currentPage < props.totalPages - 1)

const currentPageData = computed(() => ({
  left: props.currentPage,
  right: props.currentPage + 1
}))

const nextPageData = computed(() => ({
  left: props.currentPage + 2,
  right: props.currentPage + 3
}))

const prevPageData = computed(() => ({
  left: props.currentPage - 2,
  right: props.currentPage - 1
}))

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function canFlip(direction: 'left' | 'right'): boolean {
  if (props.isRapidScanMode) return false
  if (isFlipping.value) return false
  return direction === 'left' ? canFlipLeft.value : canFlipRight.value
}

async function flipPage(direction: 'left' | 'right') {
  if (!canFlip(direction)) return

  isFlipping.value = true
  flipDirection.value = direction
  flipProgress.value = 0
  activeFlipPage.value = direction === 'right' 
    ? currentPageData.value.right 
    : currentPageData.value.left

  emit('flip-start')

  const startTime = performance.now()

  await new Promise<void>((resolve) => {
    function animate(currentTime: number) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / FLIP_DURATION, 1)
      const easedProgress = easeInOutCubic(progress)

      flipProgress.value = easedProgress

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        resolve()
      }
    }
    requestAnimationFrame(animate)
  })

  const newPage = direction === 'right'
    ? Math.min(props.currentPage + 2, props.totalPages - 1)
    : Math.max(props.currentPage - 2, 1)

  if (newPage !== props.currentPage) {
    emit('page-change', newPage)
    bookStore.updateCurrentPage(newPage)
  }

  isFlipping.value = false
  flipDirection.value = null
  flipProgress.value = 0
  activeFlipPage.value = null

  emit('flip-end')
}

function handleRightEdgeClick() {
  flipPage('right')
}

function handleLeftEdgeClick() {
  flipPage('left')
}

function handleKeydown(e: KeyboardEvent) {
  if (props.isRapidScanMode) return

  if (e.key === 'ArrowRight') {
    e.preventDefault()
    flipPage('right')
  }
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    flipPage('left')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

watch(() => props.isRapidScanMode, (newMode) => {
  if (newMode && isFlipping.value) {
    isFlipping.value = false
    flipProgress.value = 0
    flipDirection.value = null
    activeFlipPage.value = null
  }
})

defineExpose({
  flipPage,
  isFlipping
})
</script>

<template>
  <div class="page-flip-container" :style="{ perspective: `${PERSPECTIVE}px` }">
    <div class="book-spread relative w-full h-full">
      <div
        v-if="flipDirection === 'right' && isFlipping"
        class="flipping-page flipping-page-right absolute inset-0"
        :style="{
          transform: `rotateY(${flipProgress * -180}deg)`,
          transformOrigin: 'left center',
          zIndex: 100
        }"
      >
        <div class="page-face page-face-front w-full h-full relative">
          <slot name="flip-page-front" :page="currentPageData.right" />
          <div 
            class="page-curl-overlay absolute inset-0 pointer-events-none"
            :style="{
              background: `linear-gradient(
                135deg,
                rgba(0,0,0,0) 0%,
                rgba(0,0,0,0) ${40 + flipProgress * 30}%,
                rgba(0,0,0,${0.15 * (1 - flipProgress)}) ${50 + flipProgress * 20}%,
                rgba(0,0,0,${0.1 * (1 - flipProgress)}) 100%
              )`
            }"
          />
        </div>
        <div class="page-face page-face-back w-full h-full absolute inset-0" style="transform: rotateY(180deg);">
          <slot name="flip-page-back" :page="nextPageData.left" :mirrored="true" />
          <div 
            class="page-curl-overlay absolute inset-0 pointer-events-none"
            :style="{
              background: `linear-gradient(
                225deg,
                rgba(0,0,0,${0.2 * flipProgress}) 0%,
                rgba(0,0,0,${0.1 * flipProgress}) 50%,
                rgba(0,0,0,0) 100%
              )`,
              transform: 'scaleX(-1)'
            }"
          />
        </div>
      </div>

      <div
        v-if="flipDirection === 'left' && isFlipping"
        class="flipping-page flipping-page-left absolute inset-0"
        :style="{
          transform: `rotateY(${(1 - flipProgress) * 180}deg)`,
          transformOrigin: 'right center',
          zIndex: 100
        }"
      >
        <div class="page-face page-face-front w-full h-full relative">
          <slot name="flip-page-front" :page="currentPageData.left" />
          <div 
            class="page-curl-overlay absolute inset-0 pointer-events-none"
            :style="{
              background: `linear-gradient(
                225deg,
                rgba(0,0,0,0) 0%,
                rgba(0,0,0,0) ${40 + flipProgress * 30}%,
                rgba(0,0,0,${0.15 * (1 - flipProgress)}) ${50 + flipProgress * 20}%,
                rgba(0,0,0,${0.1 * (1 - flipProgress)}) 100%
              )`
            }"
          />
        </div>
        <div class="page-face page-face-back w-full h-full absolute inset-0" style="transform: rotateY(180deg);">
          <slot name="flip-page-back" :page="prevPageData.right" :mirrored="true" />
          <div 
            class="page-curl-overlay absolute inset-0 pointer-events-none"
            :style="{
              background: `linear-gradient(
                135deg,
                rgba(0,0,0,${0.2 * flipProgress}) 0%,
                rgba(0,0,0,${0.1 * flipProgress}) 50%,
                rgba(0,0,0,0) 100%
              )`,
              transform: 'scaleX(-1)'
            }"
          />
        </div>
      </div>

      <div
        v-if="!isFlipping || flipDirection !== 'right'"
        class="static-page static-page-left absolute inset-0"
        :style="{
          opacity: flipDirection === 'right' && isFlipping ? 1 - flipProgress : 1,
          zIndex: flipDirection === 'right' && isFlipping ? 50 : 1
        }"
      >
        <slot name="page-left" :page="currentPageData.left" />
      </div>

      <div
        v-if="!isFlipping || flipDirection !== 'left'"
        class="static-page static-page-right absolute inset-0"
        :style="{
          opacity: flipDirection === 'left' && isFlipping ? flipProgress : 1,
          zIndex: flipDirection === 'left' && isFlipping ? 50 : 1
        }"
      >
        <slot name="page-right" :page="currentPageData.right" />
      </div>

      <div
        class="click-zone click-zone-right absolute top-0 right-0 w-16 h-full cursor-pointer"
        :class="{ 'click-zone-disabled': !canFlipRight || isRapidScanMode }"
        @click="handleRightEdgeClick"
      />
      
      <div
        class="click-zone click-zone-left absolute top-0 left-0 w-16 h-full cursor-pointer"
        :class="{ 'click-zone-disabled': !canFlipLeft || isRapidScanMode }"
        @click="handleLeftEdgeClick"
      />

      <div class="spine-shadow absolute left-1/2 -translate-x-1/2 w-12 h-full bg-gradient-to-r from-black/25 via-black/8 to-black/25 pointer-events-none z-10" />

      <div
        v-if="isFlipping"
        class="curl-highlight absolute top-0 w-20 h-full pointer-events-none z-[101]"
        :class="flipDirection === 'right' ? 'left-1/2' : 'right-1/2'"
        :style="{
          background: `linear-gradient(
            90deg,
            rgba(255,255,255,${0.3 * Math.sin(flipProgress * Math.PI)}) 0%,
            rgba(255,255,255,0) 100%
          )`,
          opacity: Math.sin(flipProgress * Math.PI)
        }"
      />
    </div>
  </div>
</template>

<style scoped>
.page-flip-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.book-spread {
  transform-style: preserve-3d;
}

.flipping-page {
  transform-style: preserve-3d;
  backface-visibility: hidden;
}

.page-face {
  backface-visibility: hidden;
  overflow: hidden;
}

.page-face-front {
  transform: rotateY(0deg);
}

.page-face-back {
  transform: rotateY(180deg);
}

.page-curl-overlay {
  mix-blend-mode: multiply;
  transition: background 0.1s linear;
}

.static-page {
  transition: opacity 0.3s ease;
}

.click-zone {
  opacity: 0;
  transition: opacity 0.2s ease, background-color 0.2s ease;
  z-index: 200;
}

.click-zone:hover:not(.click-zone-disabled) {
  opacity: 0.3;
  background: linear-gradient(
    to right,
    rgba(0, 0, 0, 0.15),
    transparent
  );
}

.click-zone-right:hover:not(.click-zone-disabled) {
  background: linear-gradient(
    to left,
    rgba(0, 0, 0, 0.15),
    transparent
  );
}

.click-zone-disabled {
  cursor: default;
}

.spine-shadow {
  opacity: 0.6;
}

.curl-highlight {
  filter: blur(8px);
  transition: opacity 0.1s linear;
}

@media (prefers-reduced-motion: reduce) {
  .flipping-page,
  .static-page,
  .page-curl-overlay,
  .curl-highlight {
    transition: none !important;
    animation: none !important;
  }
}
</style>
