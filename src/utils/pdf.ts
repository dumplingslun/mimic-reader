import * as pdfjs from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs-dist/build/pdf.worker.min.mjs'

export interface PDFDocumentProxy {
  numPages: number
  getPage: (pageNumber: number) => Promise<PDFPageProxy>
  destroy: () => Promise<void>
}

export interface PDFPageProxy {
  getViewport: (options: { scale: number; rotation?: number }) => PDFViewport
  render: (options: RenderOptions) => RenderTask
}

export interface PDFViewport {
  width: number
  height: number
  rotation: number
}

export interface RenderOptions {
  canvasContext: CanvasRenderingContext2D
  viewport: PDFViewport
  transform?: number[]
  background?: string
}

export interface RenderTask {
  promise: Promise<void>
  cancel: () => void
}

export async function loadPDFDocument(filePath: string): Promise<PDFDocumentProxy> {
  const { invoke } = await import('@tauri-apps/api/core')
  const fileData: Uint8Array = await invoke('read_pdf_file_command', { filePath })
  
  const loadingTask = pdfjs.getDocument({
    data: fileData,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    cMapUrl: '/pdfjs-dist/cmaps/',
    cMapPacked: true
  })
  
  return await loadingTask.promise
}

export async function renderPageToCanvas(
  pdfDoc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  options?: {
    scale?: number
    maxWidth?: number
    maxHeight?: number
  }
): Promise<void> {
  const page = await pdfDoc.getPage(pageNumber)
  
  const canvasWidth = canvas.clientWidth || options?.maxWidth || 600
  const canvasHeight = canvas.clientHeight || options?.maxHeight || 800
  
  const unscaledViewport = page.getViewport({ scale: 1 })
  
  let scale = options?.scale
  if (!scale) {
    const scaleX = canvasWidth / unscaledViewport.width
    const scaleY = canvasHeight / unscaledViewport.height
    scale = Math.min(scaleX, scaleY)
  }
  
  const viewport = page.getViewport({ scale })
  
  canvas.width = viewport.width
  canvas.height = viewport.height
  
  const canvasContext = canvas.getContext('2d')
  if (!canvasContext) {
    throw new Error('Could not get 2D context')
  }
  
  const renderTask = page.render({
    canvasContext,
    viewport
  })
  
  await renderTask.promise
}

export async function getPDFPageCount(filePath: string): Promise<number> {
  const { invoke } = await import('@tauri-apps/api/core')
  
  try {
    const metadata = await invoke<{ num_pages: number }>('get_pdf_metadata_command', { filePath })
    return metadata.num_pages
  } catch {
    const pdfDoc = await loadPDFDocument(filePath)
    const count = pdfDoc.numPages
    await pdfDoc.destroy()
    return count
  }
}

export async function extractCoverImage(filePath: string): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core')
  return await invoke<string>('extract_cover_command', { filePath })
}

export async function renderPageAsImage(
  pdfDoc: PDFDocumentProxy,
  pageNumber: number,
  scale: number = 0.5
): Promise<string> {
  const page = await pdfDoc.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not get canvas context')
  }
  
  const renderTask = page.render({
    canvasContext: context,
    viewport
  })
  
  await renderTask.promise
  
  return canvas.toDataURL('image/jpeg', 0.8)
}

export function preloadPages(
  pdfDoc: PDFDocumentProxy,
  pageNumbers: number[],
  scale: number = 0.3
): Promise<HTMLImageElement[]> {
  return Promise.all(
    pageNumbers.map(async (pageNum) => {
      try {
        const dataUrl = await renderPageAsImage(pdfDoc, pageNum, scale)
        const img = new Image()
        img.src = dataUrl
        return img
      } catch {
        return new Image()
      }
    })
  )
}

export interface PrefetchOptions {
  currentPage: number
  totalPages: number
  range?: number
  scale?: number
}

export async function prefetchNearbyPages(
  pdfDoc: PDFDocumentProxy,
  options: PrefetchOptions
): Promise<Map<number, string>> {
  const { currentPage, totalPages, range = 3, scale = 0.2 } = options
  const prefetched = new Map<number, string>()
  
  const pagesToPrefetch: number[] = []
  for (let i = -range; i <= range; i++) {
    const pageNum = currentPage + i
    if (pageNum >= 1 && pageNum <= totalPages && pageNum !== currentPage) {
      pagesToPrefetch.push(pageNum)
    }
  }
  
  const results = await Promise.allSettled(
    pagesToPrefetch.map(async (pageNum) => {
      try {
        const thumbnail = await renderPageAsImage(pdfDoc, pageNum, scale)
        return { pageNum, thumbnail }
      } catch (error) {
        console.error(`Failed to prefetch page ${pageNum}:`, error)
        return null
      }
    })
  )
  
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      prefetched.set(result.value.pageNum, result.value.thumbnail)
    }
  }
  
  return prefetched
}
