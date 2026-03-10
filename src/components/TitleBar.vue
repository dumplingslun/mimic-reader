<script setup lang="ts">
import { ref } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { usePlatform } from '../composables/usePlatform'

const platform = usePlatform()
const appWindow = getCurrentWindow()

const isMaximized = ref(false)
const isHovering = ref(false)

async function handleMinimize() {
  try {
    await appWindow.minimize()
  } catch (error) {
    console.error('Failed to minimize window:', error)
  }
}

async function handleMaximize() {
  try {
    await appWindow.toggleMaximize()
    isMaximized.value = await appWindow.isMaximized()
  } catch (error) {
    console.error('Failed to maximize window:', error)
  }
}

async function handleClose() {
  try {
    await appWindow.close()
  } catch (error) {
    console.error('Failed to close window:', error)
  }
}

async function handleDrag() {
  try {
    await appWindow.startDragging()
  } catch (error) {
    console.error('Failed to start dragging:', error)
  }
}

const trafficLightsOffset = platform.getTrafficLightsOffset()
const controlsSide = platform.getWindowControlsSide()
</script>

<template>
  <div
    class="titlebar"
    :class="{
      'titlebar-macos': platform.isMacOS,
      'titlebar-windows': platform.isWindows,
      'titlebar-linux': platform.isLinux,
      'titlebar-hover': isHovering
    }"
    @mouseenter="isHovering = true"
    @mouseleave="isHovering = false"
  >
    <div
      class="titlebar-drag-region"
      :style="{
        paddingLeft: controlsSide === 'left' ? `${trafficLightsOffset + 12}px` : '12px',
        paddingRight: controlsSide === 'right' ? `${trafficLightsOffset + 12}px` : '12px'
      }"
      @mousedown="handleDrag"
      @dblclick="handleMaximize"
    >
      <span class="titlebar-title">MimicReader</span>
    </div>

    <div
      class="titlebar-controls"
      :class="{ 'controls-left': controlsSide === 'left', 'controls-right': controlsSide === 'right' }"
    >
      <button
        class="titlebar-button titlebar-minimize"
        @click.stop="handleMinimize"
        title="Minimize"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" stroke-width="1.5" />
        </svg>
      </button>

      <button
        class="titlebar-button titlebar-maximize"
        @click.stop="handleMaximize"
        :title="isMaximized ? 'Restore' : 'Maximize'"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <rect x="1.5" y="1.5" width="9" height="9" stroke="currentColor" stroke-width="1.5" />
        </svg>
      </button>

      <button
        class="titlebar-button titlebar-close"
        @click.stop="handleClose"
        title="Close"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <line x1="1.5" y1="1.5" x2="10.5" y2="10.5" stroke="currentColor" stroke-width="1.5" />
          <line x1="10.5" y1="1.5" x2="1.5" y2="10.5" stroke="currentColor" stroke-width="1.5" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.titlebar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(26, 26, 26, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  user-select: none;
  z-index: 9999;
  transition: opacity 0.2s ease;
}

.titlebar-macos {
  padding-left: 12px;
  padding-right: 12px;
}

.titlebar-windows,
.titlebar-linux {
  padding-left: 12px;
  padding-right: 12px;
}

.titlebar-drag-region {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  cursor: default;
  -webkit-app-region: drag;
  app-region: drag;
}

.titlebar-title {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.3px;
  pointer-events: none;
}

.titlebar-controls {
  display: flex;
  align-items: center;
  gap: 0;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.controls-left {
  order: -1;
  margin-right: 8px;
}

.controls-right {
  order: 1;
  margin-left: 8px;
}

.titlebar-button {
  width: 46px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.15s ease;
  outline: none;
}

.titlebar-button:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
}

.titlebar-button:active {
  background: rgba(255, 255, 255, 0.12);
}

.titlebar-close:hover {
  background: rgba(255, 95, 87, 0.9);
  color: white;
}

.titlebar-close:active {
  background: rgba(255, 95, 87, 1);
}

.titlebar-minimize svg,
.titlebar-maximize svg,
.titlebar-close svg {
  opacity: 0.8;
}

.titlebar-button:hover svg {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .titlebar,
  .titlebar-button {
    transition: none;
  }
}
</style>
