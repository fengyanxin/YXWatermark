import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import { computeProcessFrameCount, exportFrameTime } from '@/lib/utils/video'
import type { VideoExportFormat } from '@/types'

export type { VideoExportFormat }

export function evenDimension(n: number): number {
  return n % 2 === 0 ? n : n - 1
}

/** 按分辨率估算码率；加水印/重编码需高于流媒体默认值，避免发糊 */
export function estimateVideoBitrate(width: number, height: number, fps: number): number {
  const pixels = width * height
  const minBitrate =
    pixels >= 3840 * 2160
      ? 35_000_000
      : pixels >= 1920 * 1080
        ? 12_000_000
        : pixels >= 1280 * 720
          ? 8_000_000
          : 5_000_000
  const raw = Math.max(minBitrate, Math.round(pixels * fps * 0.15))
  return Math.min(raw, 80_000_000)
}

function wrapVideoEncoderError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err)
  if (/not config/i.test(msg)) {
    return new Error('视频编码器未就绪，请换用 Chrome / Edge 或降低分辨率')
  }
  if (/Unsupported configuration/i.test(msg)) {
    return new Error('当前设备不支持该分辨率的 H.264 编码，请降低视频分辨率')
  }
  return err instanceof Error ? err : new Error(msg || '视频编码失败')
}

async function pickH264EncoderConfig(
  width: number,
  height: number,
  fps: number,
  bitrate: number,
): Promise<VideoEncoderConfig | null> {
  const codecs = ['avc1.42001f', 'avc1.42E01E', 'avc1.4D401F', 'avc1.640028']
  const hwModes = ['no-preference', 'prefer-software', 'prefer-hardware'] as const
  const bitrates = [bitrate, Math.round(bitrate * 0.75), Math.round(bitrate * 0.5)]

  // ponytail: mp4-muxer 需要 length-prefixed NAL（avc），annexb 会导致 mux/播放异常
  for (const codec of codecs) {
    for (const hw of hwModes) {
      for (const br of bitrates) {
        const probe: VideoEncoderConfig = {
          codec,
          width,
          height,
          bitrate: br,
          framerate: fps,
          hardwareAcceleration: hw,
          latencyMode: 'quality',
        }
        const { supported, config } = await VideoEncoder.isConfigSupported(probe)
        if (supported && config) return config
      }
    }
  }
  return null
}

function waitEncodeQueue(encoder: VideoEncoder, maxSize = 3): Promise<void> {
  if (encoder.encodeQueueSize <= maxSize) return Promise.resolve()
  return new Promise((resolve) => {
    const poll = () => {
      if (encoder.encodeQueueSize <= maxSize) resolve()
      else requestAnimationFrame(poll)
    }
    poll()
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export function pickVideoMimeType(format: VideoExportFormat): string | null {
  const webm = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  const mp4 = ['video/mp4;codecs=avc1', 'video/mp4; codecs=avc1.42E01E', 'video/mp4']
  const list = format === 'mp4' ? [...mp4, ...webm] : webm
  return list.find((t) => MediaRecorder.isTypeSupported(t)) ?? null
}

export function resolvedExportMime(requested: VideoExportFormat, picked: string): {
  format: VideoExportFormat
  mimeType: string
} {
  if (requested === 'mp4' && picked.includes('mp4')) {
    return { format: 'mp4', mimeType: picked }
  }
  return { format: 'webm', mimeType: picked.includes('webm') ? picked : 'video/webm' }
}

export function canExportMp4WithAudio(): boolean {
  return pickVideoMimeType('mp4')?.includes('mp4') ?? false
}

export function videoExtensionForFormat(format: VideoExportFormat): string {
  return format === 'mp4' ? 'mp4' : 'webm'
}

/** 1:1 绘制时关闭平滑，避免 canvas 二次插值导致发糊 */
export function drawVideoFrameSharp(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
): void {
  const prev = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(source, 0, 0, width, height)
  ctx.imageSmoothingEnabled = prev
}

export interface EncodeVideoOptions {
  width: number
  height: number
  duration: number
  fps: number
  /** 与逐帧处理一致；省略则按 duration×fps 推算 */
  frameCount?: number
  format: VideoExportFormat
  playbackVideo?: HTMLVideoElement
  renderFrame: (
    ctx: CanvasRenderingContext2D,
    time: number,
    index: number,
  ) => Promise<void> | void
  onProgress?: (progress: number) => void
}

function frameTimestampUs(index: number, fps: number): number {
  return Math.round((index * 1_000_000) / fps)
}

function resolveFrameCount(opts: EncodeVideoOptions, fps: number): number {
  return opts.frameCount ?? computeProcessFrameCount(opts.duration, fps)
}

function sourceFps(opts: EncodeVideoOptions): number {
  return Math.max(1, opts.fps)
}

function encoderFps(fps: number): number {
  return Math.max(1, Math.round(fps))
}

function waitRecorderStop(recorder: MediaRecorder): Promise<Blob[]> {
  const chunks: Blob[] = []
  return new Promise((resolve, reject) => {
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    recorder.onerror = () => reject(new Error('视频编码失败'))
    recorder.onstop = () => resolve(chunks)
  })
}

async function encodeWithPlayback(
  opts: EncodeVideoOptions,
  mimeType: string,
): Promise<Blob> {
  const { width, height, duration, playbackVideo, renderFrame, onProgress } = opts
  const video = playbackVideo
  if (!video) throw new Error('缺少视频源')

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Canvas 不可用')

  const stream = canvas.captureStream(0)
  const canvasTrack = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack & {
    requestFrame?: () => void
  }

  if (typeof video.captureStream === 'function') {
    for (const track of video.captureStream().getAudioTracks()) {
      stream.addTrack(track)
    }
  }

  const bitrate = estimateVideoBitrate(width, height, opts.fps)
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate })
  const chunksPromise = waitRecorderStop(recorder)

  video.currentTime = 0
  await video.play()
  recorder.start(100)

  await new Promise<void>((resolve, reject) => {
    let frameIndex = 0

    const onVideoFrame = () => {
      if (video.ended || video.currentTime >= duration) {
        recorder.stop()
        video.pause()
        resolve()
        return
      }

      void Promise.resolve(renderFrame(ctx, video.currentTime, frameIndex))
        .then(() => {
          canvasTrack.requestFrame?.()
          frameIndex++
          onProgress?.(Math.min(99, (video.currentTime / duration) * 100))
          video.requestVideoFrameCallback(onVideoFrame)
        })
        .catch((err) => {
          recorder.stop()
          video.pause()
          reject(err)
        })
    }

    video.onended = () => {
      onProgress?.(100)
      recorder.stop()
      video.pause()
      resolve()
    }

    if (!('requestVideoFrameCallback' in video)) {
      reject(new Error('当前浏览器不支持逐帧同步导出，请使用 Chrome / Edge 最新版'))
      return
    }

    video.requestVideoFrameCallback(onVideoFrame)
  })

  const chunks = await chunksPromise
  return new Blob(chunks, { type: mimeType })
}

/** 已修复帧快速写入 + 按 fps 节拍，时长正确（MediaRecorder 回退） */
async function encodeWithPacedMediaRecorder(
  opts: EncodeVideoOptions,
  format: VideoExportFormat,
  mimeTypeOverride?: string | null,
): Promise<{
  blob: Blob
  mimeType: string
}> {
  const mimeType = mimeTypeOverride ?? pickVideoMimeType(format)
  if (!mimeType) {
    throw new Error(format === 'mp4' ? '当前浏览器不支持 MP4 编码' : '当前浏览器不支持 WebM 编码')
  }

  const srcWidth = Math.max(2, Math.round(opts.width))
  const srcHeight = Math.max(2, Math.round(opts.height))
  const encWidth = evenDimension(srcWidth)
  const encHeight = evenDimension(srcHeight)
  const fps = sourceFps(opts)
  const frameCount = resolveFrameCount(opts, fps)
  const frameMs = 1000 / fps
  const bitrate = estimateVideoBitrate(encWidth, encHeight, fps)

  const drawCanvas = document.createElement('canvas')
  drawCanvas.width = srcWidth
  drawCanvas.height = srcHeight
  const drawCtx = drawCanvas.getContext('2d', { alpha: false })
  if (!drawCtx) throw new Error('Canvas 不可用')

  const encCanvas =
    encWidth === srcWidth && encHeight === srcHeight
      ? drawCanvas
      : document.createElement('canvas')
  if (encCanvas !== drawCanvas) {
    encCanvas.width = encWidth
    encCanvas.height = encHeight
  }
  const encCtx =
    encCanvas === drawCanvas ? drawCtx : encCanvas.getContext('2d', { alpha: false })
  if (!encCtx) throw new Error('Canvas 不可用')

  const stream = encCanvas.captureStream(0)
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack & {
    requestFrame?: () => void
  }
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate })
  const chunksPromise = waitRecorderStop(recorder)
  recorder.start()

  for (let i = 0; i < frameCount; i++) {
    const tick = performance.now()
    const time = exportFrameTime(i, frameCount, opts.duration)
    await opts.renderFrame(drawCtx, time, i)
    if (encCanvas !== drawCanvas) {
      encCtx.drawImage(drawCanvas, 0, 0, encWidth, encHeight)
    }
    track.requestFrame?.()
    opts.onProgress?.(Math.min(99, ((i + 1) / frameCount) * 100))
    const wait = frameMs - (performance.now() - tick)
    if (wait > 0) await sleep(wait)
  }

  recorder.stop()
  const chunks = await chunksPromise
  opts.onProgress?.(100)
  return { blob: new Blob(chunks, { type: mimeType }), mimeType }
}

async function encodeWithWebCodecsMp4(opts: EncodeVideoOptions): Promise<Blob> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('WebCodecs 不可用')
  }

  const srcWidth = Math.max(2, Math.round(opts.width))
  const srcHeight = Math.max(2, Math.round(opts.height))
  const encWidth = evenDimension(srcWidth)
  const encHeight = evenDimension(srcHeight)
  const fps = sourceFps(opts)
  const encRate = encoderFps(fps)
  const frameCount = resolveFrameCount(opts, fps)
  const bitrate = estimateVideoBitrate(encWidth, encHeight, fps)

  const encoderConfig = await pickH264EncoderConfig(encWidth, encHeight, encRate, bitrate)
  if (!encoderConfig) {
    throw new Error('H.264 编码不可用')
  }

  const target = new ArrayBufferTarget()
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: encWidth, height: encHeight, frameRate: encRate },
    fastStart: 'in-memory',
  })

  let encodeError: Error | null = null
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encodeError = wrapVideoEncoderError(e)
    },
  })

  encoder.configure(encoderConfig)
  if (encoder.state !== 'configured') {
    throw new Error('VideoEncoder configure failed')
  }

  const drawCanvas = document.createElement('canvas')
  drawCanvas.width = srcWidth
  drawCanvas.height = srcHeight
  const drawCtx = drawCanvas.getContext('2d', { alpha: false })
  if (!drawCtx) throw new Error('Canvas 不可用')

  const encCanvas =
    encWidth === srcWidth && encHeight === srcHeight
      ? drawCanvas
      : document.createElement('canvas')
  if (encCanvas !== drawCanvas) {
    encCanvas.width = encWidth
    encCanvas.height = encHeight
  }
  const encCtx =
    encCanvas === drawCanvas ? drawCtx : encCanvas.getContext('2d', { alpha: false })
  if (!encCtx) throw new Error('Canvas 不可用')

  try {
    for (let i = 0; i < frameCount; i++) {
      if (encodeError) throw encodeError

      const time = exportFrameTime(i, frameCount, opts.duration)
      await opts.renderFrame(drawCtx, time, i)
      if (encCanvas !== drawCanvas) {
        encCtx.drawImage(drawCanvas, 0, 0, encWidth, encHeight)
      }

      await waitEncodeQueue(encoder)

      const timestamp = frameTimestampUs(i, fps)
      const duration = frameTimestampUs(i + 1, fps) - timestamp
      const frame = new VideoFrame(encCanvas, { timestamp, duration })
      try {
        encoder.encode(frame, { keyFrame: i <= 2 || i % encRate === 0 })
      } finally {
        frame.close()
      }

      opts.onProgress?.(Math.min(99, ((i + 1) / frameCount) * 100))
    }

    if (encodeError) throw encodeError
    await encoder.flush()
  } finally {
    try {
      encoder.close()
    } catch {
      /* ignore */
    }
  }

  muxer.finalize()
  opts.onProgress?.(100)
  return new Blob([target.buffer], { type: 'video/mp4' })
}

export interface FixedTimestampEncodeResult {
  blob: Blob
  format: VideoExportFormat
  mimeType: string
  /** 非 MP4 主路径时的人类可读原因 */
  fallbackReason?: string
}

/** WebCodecs 固定时间戳 MP4；失败则 MediaRecorder MP4，最后 WebM */
async function encodeWithFixedTimestamps(
  opts: EncodeVideoOptions,
): Promise<FixedTimestampEncodeResult> {
  let webCodecsError = 'WebCodecs MP4 不可用'
  try {
    const blob = await encodeWithWebCodecsMp4(opts)
    return { blob, format: 'mp4', mimeType: 'video/mp4' }
  } catch (err) {
    webCodecsError = err instanceof Error ? err.message : String(err)
  }

  const mp4Mime = pickVideoMimeType('mp4')
  if (mp4Mime?.includes('mp4')) {
    try {
      const { blob, mimeType } = await encodeWithPacedMediaRecorder(opts, 'mp4', mp4Mime)
      return {
        blob,
        format: 'mp4',
        mimeType,
        fallbackReason: webCodecsError,
      }
    } catch (err) {
      webCodecsError = err instanceof Error ? err.message : String(err)
    }
  }

  const { blob, mimeType } = await encodeWithPacedMediaRecorder(opts, 'webm')
  return {
    blob,
    format: 'webm',
    mimeType,
    fallbackReason: webCodecsError,
  }
}

export async function exportVideo(
  opts: EncodeVideoOptions & { mode: 'playback' | 'seek' },
): Promise<{
  blob: Blob
  format: VideoExportFormat
  mimeType: string
  hasAudio: boolean
  fallbackReason?: string
}> {
  if (opts.mode === 'seek') {
    const result = await encodeWithFixedTimestamps(opts)
    return { ...result, hasAudio: false }
  }

  const picked = pickVideoMimeType(opts.format)
  const wantsMp4 = opts.format === 'mp4'

  if (wantsMp4 && (!picked || !picked.includes('mp4'))) {
    const result = await encodeWithFixedTimestamps(opts)
    return { ...result, hasAudio: false }
  }

  if (!picked) {
    throw new Error('当前浏览器不支持视频编码')
  }

  const { format, mimeType } = resolvedExportMime(opts.format, picked)

  if (opts.playbackVideo && 'requestVideoFrameCallback' in opts.playbackVideo) {
    const blob = await encodeWithPlayback(opts, mimeType)
    return { blob, format, mimeType, hasAudio: blob.type.includes('webm') || format === 'mp4' }
  }

  throw new Error('当前浏览器不支持逐帧同步导出，请使用 Chrome / Edge 最新版')
}
