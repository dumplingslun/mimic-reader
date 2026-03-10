<script setup lang="ts">
import { ref, watch } from 'vue'
import { useBookStore } from '../stores/bookStore'

const bookStore = useBookStore()

defineProps<{
  heldPage: number | null
}>()

const emit = defineEmits<{
  close: []
  toggleFingerhold: []
  returnHeld: []
}>()

const showPageSlider = ref(false)
const sliderValue = ref(1)

function toggleSlider() {
  showPageSlider.value = !showPageSlider.value
  if (showPageSlider.value && bookStore.currentBook) {
    sliderValue.value = bookStore.currentBook.currentPage
  }
}

function handleSliderChange(e: Event) {
  const target = e.target as HTMLInputElement
  sliderValue.value = parseInt(target.value)
}

function handleSliderEnd() {
  if (bookStore.currentBook) {
    bookStore.updateCurrentPage(sliderValue.value)
    window.dispatchEvent(new CustomEvent('go-to-page', { detail: sliderValue.value }))
  }
  showPageSlider.value = false
}

watch(() => bookStore.currentBook?.currentPage, (page) => {
  if (page) sliderValue.value = page
})
</script>

<template>
  <div class="reader-controls absolute inset-0 pointer-events-none">
    <!-- Top Bar -->
    <div class="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
      <div class="flex items-center justify-between">
        <button 
          @click="$emit('close')"
          class="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <h2 class="text-white font-medium truncate max-w-md">
          {{ bookStore.currentBook?.title }}
        </h2>
        
        <div class="flex items-center gap-2">
          <button 
            @click="$emit('toggleFingerhold')"
            class="p-2 rounded-lg transition-colors"
            :class="heldPage !== null ? 'bg-yellow-500/80 text-black' : 'text-white hover:bg-white/10'"
            :title="heldPage !== null ? 'Release fingerhold' : 'Hold current page'"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
          
          <button 
            v-if="heldPage !== null"
            @click="$emit('returnHeld')"
            class="p-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-colors animate-pulse"
            title="Return to held page"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Bottom Bar -->
    <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-auto">
      <div class="flex items-center justify-center gap-4">
        <span class="text-white text-sm">
          Page {{ bookStore.currentBook?.currentPage }} / {{ bookStore.currentBook?.totalPages }}
        </span>
        
        <button 
          @click="toggleSlider"
          class="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
      </div>
      
      <!-- Page Slider (Rapid Scanning) -->
      <div 
        v-if="showPageSlider" 
        class="absolute bottom-16 left-4 right-4 bg-black/90 rounded-lg p-4"
      >
        <div class="flex items-center gap-4">
          <span class="text-white text-sm w-12">{{ sliderValue }}</span>
          <input 
            type="range" 
            :min="1"
            :max="bookStore.currentBook?.totalPages || 1"
            v-model.number="sliderValue"
            @input="handleSliderChange"
            @change="handleSliderEnd"
            class="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <span class="text-gray-400 text-sm">{{ bookStore.currentBook?.totalPages }}</span>
        </div>
        <p class="text-gray-500 text-xs mt-2 text-center">Scroll to rapidly flip through pages</p>
      </div>
    </div>
    
    <!-- Side click zones for page flipping -->
    <div class="absolute top-20 bottom-20 left-0 w-1/4 pointer-events-auto" />
    <div class="absolute top-20 bottom-20 right-0 w-1/4 pointer-events-auto" />
  </div>
</template>
