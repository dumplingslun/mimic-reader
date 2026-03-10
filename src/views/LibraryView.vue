<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useBookStore } from '../stores/bookStore'
import BookCard from '../components/BookCard.vue'
import { invoke } from '@tauri-apps/api/core'
import type { Book } from '../types'

const bookStore = useBookStore()

const searchQuery = ref('')
const isScanning = ref(false)
const customDirectory = ref('')
const showDirectoryInput = ref(false)

const filteredBooks = computed(() => {
  if (!searchQuery.value.trim()) {
    return bookStore.books
  }
  
  const query = searchQuery.value.toLowerCase()
  return bookStore.books.filter(book =>
    book.title.toLowerCase().includes(query) ||
    book.author?.toLowerCase().includes(query)
  )
})

const sortBy = ref<'title' | 'addedAt' | 'lastOpened'>('addedAt')

const sortedBooks = computed(() => {
  const books = [...filteredBooks.value]
  
  switch (sortBy.value) {
    case 'title':
      return books.sort((a, b) => a.title.localeCompare(b.title))
    case 'addedAt':
      return books.sort((a, b) => b.addedAt - a.addedAt)
    case 'lastOpened':
      return books.sort((a, b) => {
        const aTime = a.lastOpened || 0
        const bTime = b.lastOpened || 0
        return bTime - aTime
      })
    default:
      return books
  }
})

onMounted(() => {
  loadLibrary()
})

async function loadLibrary() {
  bookStore.isLoading = true
  bookStore.error = null
  
  try {
    const result = await invoke<Book[]>('get_library')
    
    if (result.length === 0) {
      const homeDir = await invoke<string>('get_home_dir')
      const documentsDir = `${homeDir}/Documents`
      await scanDirectory(documentsDir)
    } else {
      bookStore.books = result
      
      for (const book of bookStore.books) {
        try {
          const coverData = await invoke<string>('get_book_cover', { bookId: book.id })
          book.coverPath = coverData
        } catch (e) {
          console.error(`Failed to load cover for ${book.title}:`, e)
          book.coverPath = generatePlaceholderCover(book.title)
        }
      }
    }
  } catch (e) {
    bookStore.error = e instanceof Error ? e.message : 'Failed to load library'
    console.error('Failed to load library:', e)
  } finally {
    bookStore.isLoading = false
  }
}

async function scanDirectory(directory: string) {
  isScanning.value = true
  
  try {
    const result = await invoke<Book[]>('scan_library', { directory })
    bookStore.books = result
    
    for (const book of bookStore.books) {
      try {
        const coverData = await invoke<string>('get_book_cover', { bookId: book.id })
        book.coverPath = coverData
      } catch (e) {
        console.error(`Failed to load cover for ${book.title}:`, e)
        book.coverPath = generatePlaceholderCover(book.title)
      }
    }
  } catch (e) {
    console.error('Failed to scan directory:', e)
  } finally {
    isScanning.value = false
  }
}

async function handleScanCustomDirectory() {
  if (!customDirectory.value.trim()) return
  
  await scanDirectory(customDirectory.value)
  showDirectoryInput.value = false
  customDirectory.value = ''
}

function generatePlaceholderCover(title: string): string {
  const colors = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444']
  const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const color = colors[hash % colors.length]
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="400">
      <defs>
        <linearGradient id="grad-${hash}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color}99;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="300" height="400" fill="url(#grad-${hash})"/>
      <text x="150" y="180" text-anchor="middle" fill="white" font-size="20" font-family="Arial" font-weight="bold">
        ${title.substring(0, 20)}${title.length > 20 ? '...' : ''}
      </text>
      <text x="150" y="210" text-anchor="middle" fill="white" font-size="14" font-family="Arial" opacity="0.8">
        PDF Document
      </text>
    </svg>
  `.trim()
  
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

async function handleSearch() {
  if (!searchQuery.value.trim()) {
    await loadLibrary()
    return
  }
  
  try {
    const result = await invoke<Book[]>('search_library', { query: searchQuery.value })
    bookStore.books = result
  } catch (e) {
    console.error('Search failed:', e)
  }
}

function handleOpenBook(book: typeof bookStore.books[0]) {
  bookStore.openBook(book)
}
</script>

<template>
  <div class="library-container min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
    <header class="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700">
      <div class="max-w-7xl mx-auto px-6 py-4">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h1 class="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              MimicReader
            </h1>
            <p class="text-gray-400 text-sm mt-1">
              {{ sortedBooks.length }} books in your library
            </p>
          </div>
          
          <div class="flex items-center gap-3">
            <button
              @click="showDirectoryInput = !showDirectoryInput"
              class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
            >
              {{ showDirectoryInput ? 'Cancel' : 'Add Folder' }}
            </button>
            
            <button
              @click="loadLibrary"
              :disabled="isScanning"
              class="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 rounded-lg text-sm transition-colors flex items-center gap-2"
            >
              <svg v-if="isScanning" class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>
        
        <div v-if="showDirectoryInput" class="mb-4 flex gap-2">
          <input
            v-model="customDirectory"
            type="text"
            placeholder="Enter directory path to scan for PDFs..."
            class="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-purple-500"
            @keyup.enter="handleScanCustomDirectory"
          />
          <button
            @click="handleScanCustomDirectory"
            class="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
          >
            Scan
          </button>
        </div>
        
        <div class="flex items-center gap-4">
          <div class="relative flex-1 max-w-md">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search books..."
              class="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-purple-500"
              @input="handleSearch"
            />
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          </div>
          
          <select
            v-model="sortBy"
            class="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-purple-500"
          >
            <option value="addedAt">Recently Added</option>
            <option value="title">Title (A-Z)</option>
            <option value="lastOpened">Recently Opened</option>
          </select>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-6 py-8">
      <div v-if="bookStore.isLoading" class="flex items-center justify-center h-64">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p class="text-gray-400">Loading your library...</p>
        </div>
      </div>

      <div v-else-if="bookStore.error" class="text-center py-16">
        <div class="text-red-400 text-lg mb-4">{{ bookStore.error }}</div>
        <button
          @click="loadLibrary"
          class="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>

      <div v-else-if="sortedBooks.length === 0" class="text-center py-16">
        <svg class="h-24 w-24 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
        </svg>
        <h3 class="text-xl font-medium text-gray-300 mb-2">No books found</h3>
        <p class="text-gray-500 mb-6">Add PDF files to your library folder to get started</p>
        <button
          @click="showDirectoryInput = true"
          class="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
        >
          Scan for PDFs
        </button>
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        <BookCard
          v-for="book in sortedBooks"
          :key="book.id"
          :book="book"
          @open="handleOpenBook"
        />
      </div>
    </main>
  </div>
</template>
