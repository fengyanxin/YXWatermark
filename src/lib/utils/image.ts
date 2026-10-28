import type { GridPosition } from '@/types'

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    img.src = url
  })
}

export function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight, url })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    img.src = url
  })
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
}

/** 预览缩放：不超过 maxDim，且完整落入容器（含 padding） */
export function computePreviewScale(
  width: number,
  height: number,
  containerWidth: number,
  containerHeight: number,
  maxDim = 720,
  padding = 32,
): number {
  const maxW = Math.max(1, containerWidth - padding)
  const maxH = Math.max(1, containerHeight - padding)
  return Math.min(1, maxDim / Math.max(width, height), maxW / width, maxH / height)
}

export function gridPositionToCoords(
  position: GridPosition,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
): { x: number; y: number } {
  const margin = 24
  const map: Record<GridPosition, { x: number; y: number }> = {
    'top-left': { x: margin, y: margin },
    'top-center': { x: width / 2, y: margin },
    'top-right': { x: width - margin, y: margin },
    'center-left': { x: margin, y: height / 2 },
    center: { x: width / 2, y: height / 2 },
    'center-right': { x: width - margin, y: height / 2 },
    'bottom-left': { x: margin, y: height - margin },
    'bottom-center': { x: width / 2, y: height - margin },
    'bottom-right': { x: width - margin, y: height - margin },
  }
  const base = map[position]
  return { x: base.x + offsetX, y: base.y + offsetY }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('导出失败'))),
      type,
      quality,
    )
  })
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) throw new Error('无效的图片地址')
  const header = dataUrl.slice(0, comma)
  const mime = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream'
  const binary = atob(dataUrl.slice(comma + 1))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export async function imageUrlToBlob(url: string): Promise<Blob> {
  if (url.startsWith('data:')) {
    return dataUrlToBlob(url)
  }
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`资源加载失败 (${res.status})`)
    return res.blob()
  } catch (err) {
    throw new Error(formatResourceFetchError(err))
  }
}

function formatResourceFetchError(err: unknown): string {
  if (err instanceof Error && err.message.startsWith('资源加载失败')) return err.message
  if (err instanceof DOMException && err.name === 'AbortError') {
    return '资源加载超时，请重试'
  }
  if (err instanceof TypeError) {
    return '资源加载失败，请刷新页面后重试'
  }
  return err instanceof Error ? err.message : '资源加载失败'
}

export function revokeObjectUrl(url: string | null) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}
