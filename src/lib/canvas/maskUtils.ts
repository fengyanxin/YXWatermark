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

  for (let y = zone.y; y < Math.min(zone.y + zone.h, height); y++) {
    for (let x = zone.x; x < Math.min(zone.x + zone.w, width); x++) {
      if (isLikelyWatermarkPixel(data, x, y, width, height)) {
        const i = (y * width + x) * 4
        mask[i] = 255
        mask[i + 1] = 255
        mask[i + 2] = 255
        mask[i + 3] = 255
      }
    }
  }
}

/** 放宽检测：白/黑/半透明文字 + 高对比边缘（彩色水印） */
function isLikelyWatermarkPixel(
  data: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  const i = (y * width + x) * 4
  const r = data[i]
  const g = data[i + 1]
  const b = data[i + 2]
  const a = data[i + 3]
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  const contrast = sampleLocalContrast(data, x, y, width, height)

  const isLightText = lum > 170 && a > 80
  const isDarkText = lum < 90 && a > 80
  const isSemiTransparent = a > 40 && a < 245
  const isStrongEdge = contrast > 35
  const isColoredText = contrast > 22 && (Math.max(r, g, b) - Math.min(r, g, b) > 25)

  if (isSemiTransparent && contrast > 12) return true
  if ((isLightText || isDarkText) && contrast > 18) return true
  if (isStrongEdge && (isLightText || isDarkText || isColoredText)) return true
  if (isColoredText && lum > 100 && lum < 220) return true
  return false
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
  options?: {
    sourceImageUrl?: string
    rects?: { x: number; y: number; width: number; height: number }[]
  },
): Promise<string> {
  let maskUrl = maskDataUrl

  if (options?.sourceImageUrl && options.rects?.length) {
    maskUrl = await tightenRectMaskToContent(
      options.sourceImageUrl,
      maskUrl,
      width,
      height,
      options.rects,
    )
  }

  return refineMaskForInpaint(maskUrl, width, height, 1)
}

/** 矩形选区只标记水印像素，避免整块背景被 AI 替换发糊 */
async function tightenRectMaskToContent(
  imageUrl: string,
  maskDataUrl: string,
  width: number,
  height: number,
  rects: { x: number; y: number; width: number; height: number }[],
): Promise<string> {
  const [imageData, maskData] = await Promise.all([
    loadImageData(imageUrl, width, height),
    loadImageData(maskDataUrl, width, height),
  ])

  const out = new Uint8ClampedArray(maskData.data)

  for (const rect of rects) {
    if (rect.width < 4 || rect.height < 4) continue

    const x0 = Math.max(0, Math.floor(rect.x))
    const y0 = Math.max(0, Math.floor(rect.y))
    const x1 = Math.min(width, Math.ceil(rect.x + rect.width))
    const y1 = Math.min(height, Math.ceil(rect.y + rect.height))
    const rw = x1 - x0
    const rh = y1 - y0
    if (rw < 4 || rh < 4) continue

    // 清掉矩形内整块 mask，再只标水印像素
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * width + x) * 4
        out[i] = 0
        out[i + 1] = 0
        out[i + 2] = 0
        out[i + 3] = 255
      }
    }

    const zone = { x: x0, y: y0, w: rw, h: rh }
    const tempMask = new ImageData(new Uint8ClampedArray(out), width, height)
    markWatermarkPixelsInZone(imageData, tempMask, zone, width, height)

    const detected = countMaskInZone(tempMask.data, x0, y0, x1, y1, width)
    const area = rw * rh
    // 检测覆盖不足时，用内缩矩形保证能去掉水印（比整块略小，减少发糊）
    if (detected < area * 0.12) {
      fillShrinkRect(tempMask.data, x0, y0, x1, y1, width, 0.12)
    } else {
      dilateMaskInZone(tempMask.data, x0, y0, x1, y1, width, height, 2)
    }

    out.set(tempMask.data)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')
  ctx.putImageData(new ImageData(out, width, height), 0, 0)
  return canvas.toDataURL('image/png')
}

function loadImageData(url: string, width: number, height: number): Promise<ImageData> {
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
      resolve(ctx.getImageData(0, 0, width, height))
    }
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = url
  })
}

/** 在指定区域内检测文字/半透明水印像素 */
function markWatermarkPixelsInZone(
  imageData: ImageData,
  maskData: ImageData,
  zone: Zone,
  width: number,
  height: number,
) {
  markHighContrastPixels(imageData, maskData, zone, width, height)
}

function countMaskInZone(
  data: Uint8ClampedArray,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
): number {
  let n = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (data[(y * width + x) * 4] > 127) n++
    }
  }
  return n
}

/** 内缩矩形填充 mask，margin 为相对短边的比例 */
function fillShrinkRect(
  data: Uint8ClampedArray,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  marginRatio: number,
) {
  const rw = x1 - x0
  const rh = y1 - y0
  const inset = Math.max(2, Math.floor(Math.min(rw, rh) * marginRatio))
  const sx0 = x0 + inset
  const sy0 = y0 + inset
  const sx1 = x1 - inset
  const sy1 = y1 - inset
  if (sx1 <= sx0 || sy1 <= sy0) return

  for (let y = sy0; y < sy1; y++) {
    for (let x = sx0; x < sx1; x++) {
      const i = (y * width + x) * 4
      data[i] = 255
      data[i + 1] = 255
      data[i + 2] = 255
      data[i + 3] = 255
    }
  }
}

function dilateMaskInZone(
  data: Uint8ClampedArray,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  height: number,
  radius: number,
) {
  const copy = new Uint8ClampedArray(data)
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4
      if (copy[i] <= 127) continue
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radius * radius) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const ni = (ny * width + nx) * 4
          data[ni] = 255
          data[ni + 1] = 255
          data[ni + 2] = 255
          data[ni + 3] = 255
        }
      }
    }
  }
}
