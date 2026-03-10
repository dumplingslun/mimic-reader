import * as pdfjs from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs-dist/build/pdf.worker.min.mjs'

interface ThumbnailMessage {
  type: 'generate'
  filePath: string
  pageNumber: number
  scale: number
}

interface PrefetchMessage {
  type: 'prefetch'
  filePath: string
  currentPage: number
  totalPages: number
  scale: number
}

interface BatchMessage {
  type: 'batch'
  filePath: string
  pageRange: { start: number; end: number }
  scale: number
}

type WorkerMessage = ThumbnailMessage | PrefetchMessage | BatchMessage

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type } = event.data
  
  try {
    if (type === 'generate') {
      const { filePath, pageNumber, scale } = event.data
      const thumbnail = await generateThumbnail(filePath, pageNumber, scale)
      self.postMessage({ type: 'thumbnail', thumbnail, pageNumber })
    } else if (type === 'prefetch') {
      const { filePath, currentPage, totalPages, scale } = event.data
      await prefetchPages(filePath, currentPage, totalPages, scale)
    } else if (type === 'batch') {
      const { filePath, pageRange, scale } = event.data
      await generateBatchThumbnails(filePath, pageRange, scale)
    }
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error',
      pageNumber: 'pageNumber' in event.data ? event.data.pageNumber : null
    })
  }
}

async function generateThumbnail(
  filePath: string,
  pageNumber: number,
  scale: number = 0.3
): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core')
  const fileData: Uint8Array = await invoke('read_pdf_file_command', { filePath })
  
  const loadingTask = pdfjs.getDocument({
    data: fileData,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true
  })
  
  const pdfDoc = await loadingTask.promise
  const page = await pdfDoc.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  
  const canvas = new OffscreenCanvas(viewport.width, viewport.height)
  const context = canvas.getContext('2d')
  
  if (!context) {
    throw new Error('Could not get OffscreenCanvas context')
  }
  
  const renderTask = page.render({
    canvasContext: context as any,
    viewport
  })
  
  await renderTask.promise
  
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 })
  return await blobToDataURL(blob)
}

async function prefetchPages(
  filePath: string,
  currentPage: number,
  totalPages: number,
  scale: number = 0.3
) {
  const { invoke } = await import('@tauri-apps/api/core')
  const fileData: Uint8Array = await invoke('read_pdf_file_command', { filePath })
  
  const loadingTask = pdfjs.getDocument({
    data: fileData,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true
  })
  
  const pdfDoc = await loadingTask.promise
  
  const pagesToPrefetch: number[] = []
  for (let i = -3; i <= 3; i++) {
    const pageNum = currentPage + i
    if (pageNum >= 1 && pageNum <= totalPages && pageNum !== currentPage) {
      pagesToPrefetch.push(pageNum)
    }
  }
  
  for (const pageNum of pagesToPrefetch) {
    try {
      const page = await pdfDoc.getPage(pageNum)
      const viewport = page.getViewport({ scale })
      
      const canvas = new OffscreenCanvas(viewport.width, viewport.height)
      const context = canvas.getContext('2d')
      
      if (!context) continue
      
      const renderTask = page.render({
        canvasContext: context as any,
        viewport
      })
      
      await renderTask.promise
      
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 })
      const thumbnail = await blobToDataURL(blob)
      
      self.postMessage({ type: 'prefetched', thumbnail, pageNumber: pageNum })
    } catch (error) {
      console.error(`Failed to prefetch page ${pageNum}:`, error)
    }
  }
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function generateBatchThumbnails(
  filePath: string,
  pageRange: { start: number; end: number },
  scale: number = 0.15
) {
  const { invoke } = await import('@tauri-apps/api/core')
  const fileData: Uint8Array = await invoke('read_pdf_file_command', { filePath })
  
  const loadingTask = pdfjs.getDocument({
    data: fileData,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true
  })
  
  const pdfDoc = await loadingTask.promise
  
  for (let pageNum = pageRange.start; pageNum <= pageRange.end; pageNum++) {
    try {
      const page = await pdfDoc.getPage(pageNum)
      const viewport = page.getViewport({ scale })
      
      const canvas = new OffscreenCanvas(viewport.width, viewport.height)
      const context = canvas.getContext('2d')
      
      if (!context) continue
      
      const renderTask = page.render({
        canvasContext: context as any,
        viewport
      })
      
      await renderTask.promise
      
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.6 })
      const thumbnail = await blobToDataURL(blob)
      
      self.postMessage({ 
        type: 'batch-thumbnail', 
        thumbnail, 
        pageNumber: pageNum,
        isBatch: true
      })
    } catch (error) {
      console.error(`Failed to generate thumbnail for page ${pageNum}:`, error)
      self.postMessage({ 
        type: 'batch-error', 
        pageNumber: pageNum,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
  
  self.postMessage({ 
    type: 'batch-complete', 
    pageRange,
    total: pageRange.end - pageRange.start + 1
  })
}
