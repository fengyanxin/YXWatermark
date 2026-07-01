declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window {
    cv: any
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CvMat = any

let opencvReady: Promise<void> | null = null

export function loadOpenCV(): Promise<void> {
  if (window.cv?.Mat) return Promise.resolve()
  if (opencvReady) return opencvReady

  opencvReady = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://docs.opencv.org/4.9.0/opencv.js'
    script.async = true
    script.onload = () => {
      const waitForCv = () => {
        if (window.cv?.Mat) {
          resolve()
        } else {
          setTimeout(waitForCv, 50)
        }
      }
      waitForCv()
    }
    script.onerror = () => reject(new Error('OpenCV.js 加载失败'))
    document.head.appendChild(script)
  })

  return opencvReady
}

export async function inpaintWithOpenCV(
  imageUrl: string,
  maskDataUrl: string,
  width: number,
  height: number,
): Promise<string> {
  await loadOpenCV()
  const cv = window.cv

  const image = await urlToMat(imageUrl, cv, width, height)
  const mask = await urlToMat(maskDataUrl, cv, width, height, true)

  const grayMask = new cv.Mat()
  cv.cvtColor(mask, grayMask, cv.COLOR_RGBA2GRAY)
  cv.threshold(grayMask, grayMask, 127, 255, cv.THRESH_BINARY)

  const bgrImage = new cv.Mat()
  cv.cvtColor(image, bgrImage, cv.COLOR_RGBA2BGR)

  const bbox = findMaskBoundingBox(grayMask)
  if (!bbox) {
    image.delete()
    mask.delete()
    grayMask.delete()
    bgrImage.delete()
    throw new Error('未检测到有效 mask 区域')
  }

  const margin = 32
  const x1 = Math.max(0, bbox.x - margin)
  const y1 = Math.max(0, bbox.y - margin)
  const x2 = Math.min(width, bbox.x + bbox.w + margin)
  const y2 = Math.min(height, bbox.y + bbox.h + margin)
  const cropW = x2 - x1
  const cropH = y2 - y1

  const cropRect = new cv.Rect(x1, y1, cropW, cropH)
  const cropImage = bgrImage.roi(cropRect)
  const cropMask = grayMask.roi(cropRect)

  const radius = Math.min(7, Math.max(3, Math.floor(Math.min(bbox.w, bbox.h) / 20)))
  const result = new cv.Mat()
  cv.inpaint(cropImage, cropMask, result, radius, cv.INPAINT_NS)

  const output = bgrImage.clone()
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      if (cropMask.ucharPtr(y, x)[0] > 127) {
        output.ucharPtr(y1 + y, x1 + x)[0] = result.ucharPtr(y, x)[0]
        output.ucharPtr(y1 + y, x1 + x)[1] = result.ucharPtr(y, x)[1]
        output.ucharPtr(y1 + y, x1 + x)[2] = result.ucharPtr(y, x)[2]
      }
    }
  }

  const rgbaOutput = new cv.Mat()
  cv.cvtColor(output, rgbaOutput, cv.COLOR_BGR2RGBA)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  cv.imshow(canvas, rgbaOutput)

  image.delete()
  mask.delete()
  grayMask.delete()
  bgrImage.delete()
  cropImage.delete()
  cropMask.delete()
  result.delete()
  output.delete()
  rgbaOutput.delete()

  return canvas.toDataURL('image/png')
}

function findMaskBoundingBox(grayMask: CvMat): { x: number; y: number; w: number; h: number } | null {
  const cv = window.cv
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  cv.findContours(grayMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

  let minX = Infinity
  let minY = Infinity
  let maxX = 0
  let maxY = 0
  let found = false

  for (let i = 0; i < contours.size(); i++) {
    const rect = cv.boundingRect(contours.get(i))
    if (rect.width === 0 || rect.height === 0) continue
    found = true
    minX = Math.min(minX, rect.x)
    minY = Math.min(minY, rect.y)
    maxX = Math.max(maxX, rect.x + rect.width)
    maxY = Math.max(maxY, rect.y + rect.height)
  }

  contours.delete()
  hierarchy.delete()

  if (!found) return null
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

async function urlToMat(
  url: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cv: any,
  width: number,
  height: number,
  grayscale = false,
): Promise<CvMat> {
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
      const mat = cv.imread(canvas)
      if (grayscale && mat.channels?.() > 1) {
        const gray = new cv.Mat()
        cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY)
        mat.delete()
        resolve(gray)
        return
      }
      resolve(mat)
    }
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = url
  })
}
