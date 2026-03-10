<script setup lang="ts">
import { ref } from 'vue'
import LibraryView from './views/LibraryView.vue'
import ReaderView from './views/ReaderView.vue'
import TitleBar from './components/TitleBar.vue'
import { useBookStore } from './stores/bookStore'

const bookStore = useBookStore()
const isTitleBarVisible = ref(true)
</script>

<template>
  <div class="app-container">
    <TitleBar v-if="isTitleBarVisible" />
    
    <div class="app-content">
      <LibraryView v-if="!bookStore.currentBook" />
      <ReaderView v-else />
    </div>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
}

#app {
  width: 100%;
  height: 100%;
}

.app-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #1a1a1a;
  display: flex;
  flex-direction: column;
}

.app-content {
  flex: 1;
  overflow: hidden;
  margin-top: 40px;
}
</style>

