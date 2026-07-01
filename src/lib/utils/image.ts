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

export async function imageUrlToBlob(url: string): Promise<Blob> {
  const res = await fetch(url)
  return res.blob()
}

export function revokeObjectUrl(url: string | null) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}
