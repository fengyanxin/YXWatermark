/** 仅将 AI 修复结果写入 mask 区域，保留原图像素，避免 Crop 整块发糊 */
export async function compositeInpaintResult(
  originalUrl: string,
  resultSource: Blob | string,
  maskDataUrl: string,
  width: number,
  height: number,
): Promise<string> {
  const resultUrl = typeof resultSource === 'string' ? resultSource : URL.createObjectURL(resultSource)

  try {
    const [original, result, mask] = await Promise.all([
      loadToCanvas(originalUrl, width, height),
      loadToCanvas(resultUrl, width, height),
      loadToCanvas(maskDataUrl, width, height),
    ])

    const outCanvas = document.createElement('canvas')
    outCanvas.width = width
    outCanvas.height = height
    const outCtx = outCanvas.getContext('2d')
    if (!outCtx) throw new Error('Canvas 不可用')

    const oData = original.ctx.getImageData(0, 0, width, height)
    const rData = result.ctx.getImageData(0, 0, width, height)
    const mData = mask.ctx.getImageData(0, 0, width, height)
    const blended = compositeInpaintPixels(oData, rData, mData, 1)

    outCtx.putImageData(blended, 0, 0)
    return outCanvas.toDataURL('image/png')
  } finally {
    if (typeof resultSource !== 'string') {
      URL.revokeObjectURL(resultUrl)
    }
  }
}

/** 将任意图片 Blob 转为 PNG，避免 JPEG 二次压缩影响 AI 修复 */
export async function ensurePngBlob(blob: Blob, width: number, height: number): Promise<Blob> {
  if (blob.type === 'image/png') return blob
  const url = URL.createObjectURL(blob)
  try {
    const { canvas } = await loadToCanvas(url, width, height)
    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 转换失败'))), 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadToCanvas(
  url: string,
  width: number,
  height: number,
): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> {
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
      resolve({ canvas, ctx })
    }
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = url
  })
}

/** 估算 mask 白色像素占图片比例，用于提示用户缩小选区 */
export function estimateMaskCoverage(
  maskDataUrl: string,
  width: number,
  height: number,
): Promise<number> {
  return loadToCanvas(maskDataUrl, width, height).then(({ ctx }) => {
    const data = ctx.getImageData(0, 0, width, height).data
    let masked = 0
    const total = width * height
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 127) masked++
    }
    return masked / total
  })
}

/** 像素级合成 + 边缘羽化，避免选区边界生硬/整块发糊 */
export function compositeInpaintPixels(
  original: ImageData,
  result: ImageData,
  mask: ImageData,
  featherPx = 1,
): ImageData {
  const { width, height } = original
  const alpha = featherMaskAlpha(mask, width, height, featherPx)
  const out = new ImageData(width, height)

  for (let p = 0; p < width * height; p++) {
    const i = p * 4
    const a = alpha[p] / 255
    const inv = 1 - a
    out.data[i] = Math.round(original.data[i] * inv + result.data[i] * a)
    out.data[i + 1] = Math.round(original.data[i + 1] * inv + result.data[i + 1] * a)
    out.data[i + 2] = Math.round(original.data[i + 2] * inv + result.data[i + 2] * a)
    out.data[i + 3] = Math.round(original.data[i + 3] * inv + result.data[i + 3] * a)
  }
  return out
}

/** 二值 mask 盒式模糊，边缘 Alpha 过渡更自然 */
function featherMaskAlpha(
  mask: ImageData,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  const size = width * height
  let buf = new Float32Array(size)
  for (let p = 0; p < size; p++) {
    buf[p] = mask.data[p * 4] > 127 ? 1 : 0
  }
  if (radius <= 0) {
    const out = new Uint8ClampedArray(size)
    for (let p = 0; p < size; p++) out[p] = buf[p] ? 255 : 0
    return out
  }

  const passes = radius * 2 + 1
  for (let pass = 0; pass < passes; pass++) {
    buf = boxBlurFloat(buf, width, height)
  }

  const out = new Uint8ClampedArray(size)
  for (let p = 0; p < size; p++) {
    out[p] = Math.round(Math.min(1, buf[p]) * 255)
  }
  return out
}

function boxBlurFloat(src: Float32Array, width: number, height: number): Float32Array {
  const dst = new Float32Array(src.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      let count = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          sum += src[ny * width + nx]
          count++
        }
      }
      dst[y * width + x] = sum / count
    }
  }
  return dst
}

export async function loadMaskImageData(
  maskDataUrl: string,
  width: number,
  height: number,
): Promise<ImageData> {
  const { ctx } = await loadToCanvas(maskDataUrl, width, height)
  return ctx.getImageData(0, 0, width, height)
}
