import {
  compositeInpaintPixels,
  ensurePngBlob,
  loadMaskImageData,
} from '@/lib/canvas/compositeInpaint'
import { createAIServiceClient } from '@/lib/ai-service/client'
import { inpaintWithOpenCV } from '@/lib/opencv/inpaint'
import { dataUrlToBlob, imageUrlToBlob } from '@/lib/utils/image'
import { exportVideo, type VideoExportFormat } from '@/lib/video/frameEncoder'
import {
  captureVideoFrameAt,
  exportFrameTime,
  loadVideoElement,
  mountOffscreenVideo,
  primeVideoDecoder,
  resolveVideoExportTiming,
} from '@/lib/utils/video'

export interface VideoRemoveProgress {
  phase: 'prepare' | 'extract' | 'process' | 'encode'
  current: number
  total: number
}

export function computeRemoveVideoPercent(p: VideoRemoveProgress): number {
  if (p.total <= 0) return 0
  if (p.phase === 'prepare') return 1
  const i = Math.max(0, p.current - 1)
  const sub = p.phase === 'extract' ? 0.15 : p.phase === 'process' ? 0.55 : 0.95
  const pct = ((i + sub) / p.total) * 95
  return Math.min(p.phase === 'encode' && p.current === p.total ? 100 : 99, Math.max(1, Math.round(pct)))
}

export function formatRemoveVideoProgress(p: VideoRemoveProgress): string {
  if (p.phase === 'prepare') return '准备导出…'
  const labels = { extract: '提取帧', process: 'AI 修复', encode: '编码视频' } as const
  return `第 ${p.current}/${p.total} 帧 · ${labels[p.phase]}`
}

async function yieldToUi() {
  // ponytail: 后台标签页会暂停 rAF，改用 setTimeout 保证切走标签页仍能继续
  if (typeof document !== 'undefined' && !document.hidden) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    return
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

async function reportProgress(
  onProgress: RemoveVideoOptions['onProgress'],
  payload: VideoRemoveProgress,
) {
  onProgress?.(payload)
  await yieldToUi()
}

interface RemoveVideoOptions {
  videoUrl: string
  width: number
  height: number
  duration: number
  maskUrl: string
  aiServiceUrl: string
  useAi: boolean
  format: VideoExportFormat
  fps?: number
  frameCount?: number
  onProgress?: (p: VideoRemoveProgress) => void
}

const VIDEO_INPAINT_TIMEOUT_MS = 600_000

async function inpaintFrame(
  frameUrl: string,
  maskUrl: string,
  maskBlob: Blob,
  maskImageData: ImageData,
  width: number,
  height: number,
  aiClient: ReturnType<typeof createAIServiceClient> | null,
  useAi: boolean,
): Promise<ImageData> {
  const originalBlob = await ensurePngBlob(
    frameUrl.startsWith('data:') ? dataUrlToBlob(frameUrl) : await imageUrlToBlob(frameUrl),
    width,
    height,
  )

  let resultBlob: Blob
  if (useAi && aiClient) {
    resultBlob = await aiClient.inpaint(originalBlob, maskBlob, {
      width,
      height,
      textWatermark: true,
      timeoutMs: VIDEO_INPAINT_TIMEOUT_MS,
    })
  } else {
    const resultUrl = await inpaintWithOpenCV(frameUrl, maskUrl, width, height)
    resultBlob =
      resultUrl.startsWith('data:') ? dataUrlToBlob(resultUrl) : await imageUrlToBlob(resultUrl)
  }

  const [originalData, resultData] = await Promise.all([
    blobToImageData(originalBlob, width, height),
    blobToImageData(resultBlob, width, height),
  ])

  return compositeInpaintPixels(originalData, resultData, maskImageData)
}

function blobToImageData(blob: Blob, width: number, height: number): Promise<ImageData> {
  const url = URL.createObjectURL(blob)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Canvas 不可用'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      const data = ctx.getImageData(0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(data)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('帧加载失败'))
    }
    img.src = url
  })
}

function imageDataToPngBlob(data: ImageData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = data.width
  canvas.height = data.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Canvas 不可用'))
  ctx.putImageData(data, 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('帧压缩失败'))), 'image/png')
  })
}

/** 逐帧 seek + AI 修复，保持原分辨率；去水印导出不含音轨 */
export async function removeWatermarkFromVideo(
  options: RemoveVideoOptions,
): Promise<{
  blob: Blob
  mimeType: string
  format: VideoExportFormat
  frameCount: number
  fallbackReason?: string
}> {
  const {
    videoUrl,
    width,
    height,
    duration,
    maskUrl,
    aiServiceUrl,
    useAi,
    format,
    fps = 30,
    frameCount: knownFrameCount,
    onProgress,
  } = options

  const video = await loadVideoElement(videoUrl)
  const unmountVideo = mountOffscreenVideo(video)
  const exportDuration = video.duration || duration
  const exportWidth = video.videoWidth || width
  const exportHeight = video.videoHeight || height
  const { fps: exportFps, frameCount } = resolveVideoExportTiming(
    exportDuration,
    fps,
    knownFrameCount,
  )
  const aiClient = useAi ? createAIServiceClient(aiServiceUrl) : null

  await reportProgress(onProgress, { phase: 'prepare', current: 0, total: frameCount })

  const maskBlob = await ensurePngBlob(
    maskUrl.startsWith('data:') ? dataUrlToBlob(maskUrl) : await imageUrlToBlob(maskUrl),
    exportWidth,
    exportHeight,
  )
  const maskImageData = await loadMaskImageData(maskUrl, exportWidth, exportHeight)

  try {
    await primeVideoDecoder(video)
    const processedFrames: Blob[] = []

    for (let i = 0; i < frameCount; i++) {
      const time = exportFrameTime(i, frameCount, exportDuration)

      await reportProgress(onProgress, { phase: 'extract', current: i + 1, total: frameCount })
      const frameUrl = await captureVideoFrameAt(video, time, exportWidth, exportHeight)

      await reportProgress(onProgress, { phase: 'process', current: i + 1, total: frameCount })
      try {
        const frameData = await inpaintFrame(
          frameUrl,
          maskUrl,
          maskBlob,
          maskImageData,
          exportWidth,
          exportHeight,
          aiClient,
          useAi,
        )
        processedFrames.push(await imageDataToPngBlob(frameData))
      } catch (err) {
        const detail = err instanceof Error ? err.message : '未知错误'
        throw new Error(`第 ${i + 1}/${frameCount} 帧修复失败：${detail}`)
      }
    }

    const frameBitmaps = await Promise.all(processedFrames.map((blob) => createImageBitmap(blob)))

    try {
      const result = await exportVideo({
        width: exportWidth,
        height: exportHeight,
        duration: exportDuration,
        fps: exportFps,
        frameCount,
        format,
        mode: 'seek',
        renderFrame: (ctx, _time, index) => {
          const bitmap = frameBitmaps[index]
          ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
          ctx.drawImage(bitmap, 0, 0, ctx.canvas.width, ctx.canvas.height)
        },
        onProgress: (p) => {
          void reportProgress(onProgress, {
            phase: 'encode',
            current: Math.max(1, Math.round((p / 100) * frameCount)),
            total: frameCount,
          })
        },
      })

      return {
        blob: result.blob,
        mimeType: result.mimeType,
        format: result.format,
        frameCount,
        fallbackReason: result.fallbackReason,
      }
    } finally {
      frameBitmaps.forEach((b) => b.close())
    }
  } finally {
    unmountVideo()
  }
}
