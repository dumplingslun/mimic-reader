<script setup lang="ts">
import { computed } from 'vue'
import { useReaderStore } from '../stores/useReaderStore'

const readerStore = useReaderStore()

const pinnedPages = computed(() => readerStore.pinnedPages)
const pinnedCount = computed(() => readerStore.pinnedCount)

function handleThumbnailClick(pageId: string) {
  const page = pinnedPages.value.find(p => p.id === pageId)
  if (page) {
    readerStore.toggleComparison(page)
  }
}

function handleUnpin(event: Event, pageId: string) {
  event.stopPropagation()
  readerStore.unpinPage(pageId)
}
</script>

<template>
  <Transition name="slide-in">
    <div v-if="pinnedCount > 0" class="floating-strips-container">
      <div class="strips-header">
        <span class="strip-count">{{ pinnedCount }}</span>
      </div>
      
      <div class="strips-wrapper">
        <TransitionGroup name="strip-list" tag="div" class="strips-content">
          <div
            v-for="page in pinnedPages"
            :key="page.id"
            class="thumbnail-strip"
            @click="handleThumbnailClick(page.id)"
          >
            <div class="strip-thumbnail">
              <img :src="page.thumbnail" :alt="`Page ${page.pageNumber}`" />
              <div class="strip-overlay">
                <span class="page-number">{{ page.pageNumber }}</span>
              </div>
            </div>
            
            <button
              class="unpin-btn"
              @click.stop="handleUnpin($event, page.id)"
              title="Unpin page"
            >
              ×
            </button>
            
            <div class="strip-info">
              <span class="book-title">{{ page.bookTitle }}</span>
              <span class="page-label">P.{{ page.pageNumber }}</span>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.floating-strips-container {
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: calc(100vh - 32px);
}

.strips-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.strip-count {
  background: rgba(59, 130, 246, 0.9);
  color: white;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 12px;
  backdrop-filter: blur(4px);
}

.strips-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  max-height: calc(100vh - 80px);
  padding-right: 4px;
}

.strips-wrapper::-webkit-scrollbar {
  width: 4px;
}

.strips-wrapper::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

.strips-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.thumbnail-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  background: rgba(30, 30, 30, 0.85);
  backdrop-filter: blur(8px);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.thumbnail-strip:hover {
  background: rgba(40, 40, 40, 0.95);
  transform: translateX(4px);
  border-color: rgba(59, 130, 246, 0.5);
}

.strip-thumbnail {
  position: relative;
  width: 48px;
  height: 64px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.1);
}

.strip-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.strip-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  padding: 2px 4px;
  display: flex;
  justify-content: center;
}

.page-number {
  color: white;
  font-size: 10px;
  font-weight: 600;
}

.unpin-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.9);
  color: white;
  border: none;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumbnail-strip:hover .unpin-btn {
  opacity: 1;
}

.unpin-btn:hover {
  background: rgba(239, 68, 68, 1);
  transform: scale(1.1);
}

.strip-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.book-title {
  color: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.page-label {
  color: rgba(255, 255, 255, 0.5);
  font-size: 10px;
}

.slide-in-enter-active,
.slide-in-leave-active {
  transition: all 0.3s ease;
}

.slide-in-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.slide-in-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.strip-list-enter-active,
.strip-list-leave-active {
  transition: all 0.3s ease;
}

.strip-list-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.strip-list-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
</style>
