<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { loadPDFDocument, renderPageToCanvas } from '../utils/pdf'
import type { PinnedPage } from '../types'

interface Props {
  pinnedPage: PinnedPage
  isComparing: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const pdfDoc = ref<any>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)

async function loadPinnedPage() {
  if (!props.pinnedPage || !canvasRef.value) return
  
  isLoading.value = true
  error.value = null
  
  try {
    pdfDoc.value = await loadPDFDocument(props.pinnedPage.bookId)
    await renderPage()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load page'
    console.error('Failed to load pinned page:', err)
  } finally {
    isLoading.value = false
  }
}

async function renderPage() {
  if (!pdfDoc.value || !canvasRef.value) return
  
  try {
    await renderPageToCanvas(
      pdfDoc.value,
      props.pinnedPage.pageNumber,
      canvasRef.value
    )
  } catch (err) {
    error.value = 'Failed to render page'
    console.error('Render error:', err)
  }
}

function handleClose() {
  emit('close')
}

onMounted(() => {
  if (props.isComparing) {
    loadPinnedPage()
  }
})

onUnmounted(() => {
  if (pdfDoc.value) {
    pdfDoc.value.destroy()
  }
})

watch(() => props.isComparing, (newVal) => {
  if (newVal && !pdfDoc.value) {
    loadPinnedPage()
  }
})

watch(() => props.pinnedPage, () => {
  if (pdfDoc.value) {
    pdfDoc.value.destroy()
    pdfDoc.value = null
  }
  if (props.isComparing) {
    loadPinnedPage()
  }
}, { deep: true })
</script>

<template>
  <div class="mini-reader-container">
    <div class="mini-reader-header">
      <div class="header-info">
        <span class="book-title">{{ pinnedPage.bookTitle }}</span>
        <span class="page-indicator">Page {{ pinnedPage.pageNumber }}</span>
      </div>
      <button class="close-btn" @click="handleClose" title="Close comparison">
        ×
      </button>
    </div>
    
    <div class="mini-reader-content">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>Loading...</span>
      </div>
      
      <div v-else-if="error" class="error-state">
        <span>{{ error }}</span>
      </div>
      
      <canvas
        v-else
        ref="canvasRef"
        class="mini-reader-canvas"
      />
    </div>
  </div>
</template>

<style scoped>
.mini-reader-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(20, 20, 20, 0.95);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.mini-reader-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(30, 30, 30, 0.9);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.book-title {
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.page-indicator {
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
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

.mini-reader-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow: hidden;
}

.mini-reader-canvas {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: rgba(59, 130, 246, 0.9);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-state {
  color: rgba(239, 68, 68, 0.9);
  font-size: 13px;
  text-align: center;
}
</style>
