import { ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import type { Book } from '../types'

export interface WorkspaceState {
  lastPage: number
  pinnedPages: number[]
  layout: 'single' | 'split'
}

interface DebounceTimer {
  timer: number | null
  pendingData: WorkspaceState | null
}

export function useWorkspacePersistence() {
  const currentBookId = ref<string | null>(null)
  const isSaving = ref(false)
  const debounceTimers = ref<Map<string, DebounceTimer>>(new Map())

  async function saveState(bookId: string, filePath: string, state: WorkspaceState): Promise<void> {
    try {
      isSaving.value = true
      await invoke('save_workspace_state', {
        pdfPath: filePath,
        lastPage: state.lastPage,
        pinnedPages: state.pinnedPages,
        layout: state.layout
      })
    } catch (error) {
      console.error('Failed to save workspace state:', error)
    } finally {
      isSaving.value = false
    }
  }

  async function loadState(bookId: string, filePath: string): Promise<WorkspaceState | null> {
    try {
      const result = await invoke<WorkspaceState | null>('load_workspace_state', { 
        pdfPath: filePath 
      })
      return result
    } catch (error) {
      console.error('Failed to load workspace state:', error)
      return null
    }
  }

  function debouncedSave(
    bookId: string,
    filePath: string,
    state: WorkspaceState,
    delay: number = 1000
  ): void {
    const existingTimer = debounceTimers.value.get(filePath)

    if (existingTimer?.timer) {
      window.clearTimeout(existingTimer.timer)
      existingTimer.pendingData = state
    } else {
      const timer = window.setTimeout(async () => {
        const timerData = debounceTimers.value.get(filePath)
        if (timerData?.pendingData) {
          await saveState(bookId, filePath, timerData.pendingData)
        }
        debounceTimers.value.delete(filePath)
      }, delay)

      debounceTimers.value.set(filePath, {
        timer,
        pendingData: state
      })
    }
  }

  function cancelPendingSave(bookId: string, filePath: string): void {
    const existingTimer = debounceTimers.value.get(filePath)

    if (existingTimer?.timer) {
      window.clearTimeout(existingTimer.timer)
      debounceTimers.value.delete(filePath)
    }
  }

  function clearWorkspaceState(bookId: string, filePath: string): void {
    cancelPendingSave(bookId, filePath)
  }

  async function restoreWorkspace(book: Book): Promise<{
    restoredPage: number
    pinnedPages: number[]
    layout: 'single' | 'split'
  } | null> {
    const state = await loadState(book.id, book.filePath)
    
    if (!state) {
      return null
    }

    return {
      restoredPage: state.lastPage,
      pinnedPages: state.pinnedPages,
      layout: state.layout
    }
  }

  return {
    currentBookId,
    isSaving,
    saveState,
    loadState,
    debouncedSave,
    cancelPendingSave,
    restoreWorkspace,
    clearWorkspaceState
  }
}
