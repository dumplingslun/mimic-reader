<script setup lang="ts">
import { computed } from 'vue'
import type { Book } from '../types'

const props = defineProps<{
  book: Book
}>()

defineEmits<{
  open: [book: Book]
}>()

const formattedDate = computed(() => {
  return new Date(props.book.addedAt * 1000).toLocaleDateString()
})

const progressPercent = computed(() => {
  if (props.book.totalPages === 0) return 0
  return Math.round((props.book.currentPage / props.book.totalPages) * 100)
})
</script>

<template>
  <div 
    class="book-card group cursor-pointer"
    @click="$emit('open', book)"
  >
    <div class="book-cover-wrapper relative aspect-[3/4] overflow-hidden rounded-lg shadow-xl bg-gray-800">
      <img 
        :src="book.coverPath" 
        :alt="book.title"
        class="w-full h-full object-cover transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl"
        loading="lazy"
        @error="($event.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iNDAwIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjE1MCIgeT0iMjAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjY2IiBmb250LXNpemU9IjE0Ij5ObyBDb3ZlcjwvdGV4dD48L3N2Zz4='"
      />
      
      <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div class="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
        <div class="flex items-center justify-between text-xs text-gray-300 mb-2">
          <span>Page {{ book.currentPage }}</span>
          <span>{{ book.totalPages }} total</span>
        </div>
        
        <div class="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
          <div 
            class="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>
      </div>
      
      <div v-if="book.lastOpened" class="absolute top-2 right-2">
        <span class="px-2 py-1 bg-green-500/90 text-white text-xs rounded-full">
          Recent
        </span>
      </div>
    </div>
    
    <div class="mt-3">
      <h3 
        class="font-medium text-white truncate text-sm group-hover:text-purple-400 transition-colors" 
        :title="book.title"
      >
        {{ book.title }}
      </h3>
      
      <p v-if="book.author" class="text-xs text-gray-400 mt-1 truncate">
        {{ book.author }}
      </p>
      
      <div class="flex items-center justify-between mt-2 text-xs text-gray-500">
        <span>{{ book.totalPages }} pages</span>
        <span>{{ formattedDate }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.book-card {
  @apply transition-all duration-200;
}

.book-card:hover {
  transform: translateY(-8px);
}

.book-card:active {
  transform: translateY(-4px);
}
</style>
