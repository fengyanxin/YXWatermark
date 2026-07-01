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
    const out = outCtx.createImageData(width, height)

    for (let i = 0; i < oData.data.length; i += 4) {
      // mask 白色区域使用 AI 结果，其余保持原图 100% 像素
      if (mData.data[i] > 127) {
        out.data[i] = rData.data[i]
        out.data[i + 1] = rData.data[i + 1]
        out.data[i + 2] = rData.data[i + 2]
        out.data[i + 3] = rData.data[i + 3]
      } else {
        out.data[i] = oData.data[i]
        out.data[i + 1] = oData.data[i + 1]
        out.data[i + 2] = oData.data[i + 2]
        out.data[i + 3] = oData.data[i + 3]
      }
    }

    outCtx.putImageData(out, 0, 0)
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
