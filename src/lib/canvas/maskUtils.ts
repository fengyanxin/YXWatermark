/** 从 Konva 绘制的 mask 层导出黑白 mask 图 */
export function maskLayerToDataUrl(
  lines: { points: number[]; strokeWidth: number }[],
  rects: { x: number; y: number; width: number; height: number }[],
  width: number,
  height: number,
): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = '#ffffff'
  ctx.fillStyle = '#ffffff'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const line of lines) {
    ctx.lineWidth = line.strokeWidth
    ctx.beginPath()
    const pts = line.points
    if (pts.length >= 2) {
      ctx.moveTo(pts[0], pts[1])
      for (let i = 2; i < pts.length; i += 2) {
        ctx.lineTo(pts[i], pts[i + 1])
      }
    }
    ctx.stroke()
  }

  for (const rect of rects) {
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
  }

  return canvas.toDataURL('image/png')
}

/** 膨胀 mask 并二值化，覆盖半透明水印边缘，提升 LaMa 修复质量 */
export function refineMaskForInpaint(
  maskDataUrl: string,
  width: number,
  height: number,
  dilateRadius = 2,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas 不可用'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      const imageData = ctx.getImageData(0, 0, width, height)
      const refined = dilateMask(imageData, dilateRadius)
      ctx.putImageData(refined, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('Mask 加载失败'))
    img.src = maskDataUrl
  })
}

function dilateMask(imageData: ImageData, radius: number): ImageData {
  const { width, height, data } = imageData
  const out = new Uint8ClampedArray(data)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i] <= 127) continue
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radius * radius) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const ni = (ny * width + nx) * 4
          out[ni] = 255
          out[ni + 1] = 255
          out[ni + 2] = 255
          out[ni + 3] = 255
        }
      }
    }
  }

  return new ImageData(out, width, height)
}

/** 简单水印区域检测：扫描四角与边缘高对比度像素，生成 inpaint 用 mask */
export function detectWatermarkMask(
  imageUrl: string,
  width: number,
  height: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas 不可用'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      const imageData = ctx.getImageData(0, 0, width, height)
      const maskCanvas = document.createElement('canvas')
      maskCanvas.width = width
      maskCanvas.height = height
      const maskCtx = maskCanvas.getContext('2d')
      if (!maskCtx) {
        reject(new Error('Canvas 不可用'))
        return
      }

      const maskData = maskCtx.createImageData(width, height)
      const zones = getDetectionZones(width, height)

      for (const zone of zones) {
        markHighContrastPixels(imageData, maskData, zone, width, height)
      }

      maskCtx.putImageData(maskData, 0, 0)
      const raw = maskCanvas.toDataURL('image/png')
      resolve(refineMaskForInpaint(raw, width, height, 1))
    }
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = imageUrl
  })
}

interface Zone {
  x: number
  y: number
  w: number
  h: number
}

function getDetectionZones(width: number, height: number): Zone[] {
  const edgeW = Math.floor(width * 0.25)
  const edgeH = Math.floor(height * 0.15)
  return [
    { x: 0, y: height - edgeH, w: width, h: edgeH },
    { x: width - edgeW, y: 0, w: edgeW, h: height },
    { x: 0, y: 0, w: edgeW, h: edgeH },
  ]
}

function markHighContrastPixels(
  imageData: ImageData,
  maskData: ImageData,
  zone: Zone,
  width: number,
  height: number,
) {
  const { data } = imageData
  const { data: mask } = maskData
  const threshold = 40

  for (let y = zone.y; y < Math.min(zone.y + zone.h, height); y++) {
    for (let x = zone.x; x < Math.min(zone.x + zone.w, width); x++) {
      const i = (y * width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]
      const lum = 0.299 * r + 0.587 * g + 0.114 * b

      const isLightText = lum > 200 && a > 100
      const isDarkText = lum < 60 && a > 100
      const isSemiTransparent = a > 50 && a < 230

      if (isLightText || isDarkText || isSemiTransparent) {
        const neighborContrast = sampleLocalContrast(data, x, y, width, height)
        if (neighborContrast > threshold || isSemiTransparent) {
          mask[i] = 255
          mask[i + 1] = 255
          mask[i + 2] = 255
          mask[i + 3] = 255
        }
      }
    }
  }
}

function sampleLocalContrast(
  data: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  const i = (y * width + x) * 4
  const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  let maxDiff = 0
  const offsets = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]
  for (const [dx, dy] of offsets) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
    const ni = (ny * width + nx) * 4
    const nlum = 0.299 * data[ni] + 0.587 * data[ni + 1] + 0.114 * data[ni + 2]
    maxDiff = Math.max(maxDiff, Math.abs(lum - nlum))
  }
  return maxDiff
}

export async function prepareMaskForInpaint(
  maskDataUrl: string,
  width: number,
  height: number,
): Promise<string> {
  // 文字水印仅 1px 膨胀，避免修复区域过大
  return refineMaskForInpaint(maskDataUrl, width, height, 1)
}
