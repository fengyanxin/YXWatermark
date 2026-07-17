import { DEFAULT_VIDEO_FPS, MAX_VIDEO_DURATION } from '@/types'

export function loadVideoElement(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true

    let resolved = false
    const finish = () => {
      if (resolved) return
      resolved = true
      resolve(video)
    }
    const fail = () => {
      if (resolved) return
      resolved = true
      reject(new Error('视频加载失败'))
    }

    video.addEventListener('loadeddata', finish, { once: true })
    video.addEventListener('error', fail, { once: true })
    video.src = url
    video.load()

    if (video.readyState >= 2) finish()
  })
}

/** 离屏挂载；尺寸须接近原片，1×1 会导致部分浏览器解码黑帧 */
export function mountOffscreenVideo(video: HTMLVideoElement): () => void {
  const w = video.videoWidth || 640
  const h = video.videoHeight || 360
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = `position:fixed;left:-9999px;top:0;width:${w}px;height:${h}px;overflow:hidden;opacity:0;pointer-events:none`
  video.style.width = `${w}px`
  video.style.height = `${h}px`
  host.appendChild(video)
  document.body.appendChild(host)
  return () => host.remove()
}

export function getVideoMeta(
  file: File,
): Promise<{
  width: number
  height: number
  duration: number
  url: string
  fps: number
  frameCount?: number
  firstFrameUrl: string
}> {
  const url = URL.createObjectURL(file)
  return loadVideoElement(url).then(async (video) => {
    const unmount = mountOffscreenVideo(video)
    try {
      const fromFile = await parseVideoInfoFromFile(file)
      const fps = await resolveVideoExportFps(video, fromFile)
      const frameCount = computeProcessFrameCount(video.duration, fps)
      await primeVideoDecoder(video)
      const firstFrameUrl = await captureVideoFrameAt(video, 0, video.videoWidth, video.videoHeight)
      return {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
        url,
        fps,
        frameCount,
        firstFrameUrl,
      }
    } finally {
      unmount()
    }
  })
}

function readBoxType(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  )
}

interface Mp4VideoInfo {
  fps: number
  frameCount: number
}

/** 从 MP4/MOV 容器读取帧率与样本数 */
async function parseVideoInfoFromFile(file: File): Promise<Mp4VideoInfo | null> {
  if (!file.type.includes('mp4') && !file.type.includes('quicktime') && !file.name.match(/\.(mp4|mov)$/i)) {
    return null
  }
  const chunk = Math.min(file.size, 16 * 1024 * 1024)
  let info = parseMp4VideoInfo(await file.slice(0, chunk).arrayBuffer())
  if (!info && file.size > chunk) {
    info = parseMp4VideoInfo(await file.slice(file.size - chunk).arrayBuffer())
  }
  return info
}

function parseMp4VideoInfo(buffer: ArrayBuffer): Mp4VideoInfo | null {
  const view = new DataView(buffer)

  const parseTrak = (start: number, end: number): Mp4VideoInfo | null => {
    if (!trackHasVideoHandler(view, start, end)) return null

    let timescale: number | null = null
    let sttsSamples = 0
    let sttsTicks = 0
    let stszCount: number | null = null

    const walk = (s: number, e: number) => {
      let offset = s
      while (offset + 8 <= e) {
        let size = view.getUint32(offset)
        let header = 8
        if (size === 1 && offset + 16 <= e) {
          size = Number(view.getBigUint64(offset + 8))
          header = 16
        }
        if (size < header) break

        const type = readBoxType(view, offset + 4)
        const bodyStart = offset + header
        const bodyEnd = Math.min(offset + size, e)

        if (type === 'mdhd') {
          const ts = readMdhdTimescale(view, bodyStart, bodyEnd)
          if (ts) timescale = ts
        } else if (type === 'stts') {
          const { samples, ticks } = readSttsTotals(view, bodyStart, bodyEnd)
          if (samples > 0) {
            sttsSamples = samples
            sttsTicks = ticks
          }
        } else if (type === 'stsz') {
          const count = readStszSampleCount(view, bodyStart, bodyEnd)
          if (count) stszCount = count
        } else if (type === 'mdia' || type === 'minf' || type === 'stbl') {
          walk(bodyStart, bodyEnd)
        }

        offset += size
      }
    }

    walk(start, end)
    const frameCount = stszCount ?? sttsSamples
    if (!timescale || !frameCount || sttsTicks <= 0) return null

    const durationSec = sttsTicks / timescale
    if (durationSec <= 0) return null

    return {
      fps: snapCommonFps(frameCount / durationSec),
      frameCount,
    }
  }

  let offset = 0
  while (offset + 8 <= buffer.byteLength) {
    let size = view.getUint32(offset)
    let header = 8
    if (size === 1 && offset + 16 <= buffer.byteLength) {
      size = Number(view.getBigUint64(offset + 8))
      header = 16
    }
    if (size < header) break

    const type = readBoxType(view, offset + 4)
    const bodyStart = offset + header
    const bodyEnd = Math.min(offset + size, buffer.byteLength)

    if (type === 'moov') {
      let trakOff = bodyStart
      while (trakOff + 8 <= bodyEnd) {
        let trakSize = view.getUint32(trakOff)
        let trakHeader = 8
        if (trakSize === 1 && trakOff + 16 <= bodyEnd) {
          trakSize = Number(view.getBigUint64(trakOff + 8))
          trakHeader = 16
        }
        if (trakSize < trakHeader) break
        const trakType = readBoxType(view, trakOff + 4)
        if (trakType === 'trak') {
          const info = parseTrak(trakOff + trakHeader, trakOff + trakSize)
          if (info) return info
        }
        trakOff += trakSize
      }
    }

    offset += size
  }

  return null
}

function trackHasVideoHandler(view: DataView, start: number, end: number): boolean {
  let found = false
  const walk = (s: number, e: number) => {
    let offset = s
    while (offset + 8 <= e) {
      let size = view.getUint32(offset)
      let header = 8
      if (size === 1 && offset + 16 <= e) {
        size = Number(view.getBigUint64(offset + 8))
        header = 16
      }
      if (size < header) break
      const type = readBoxType(view, offset + 4)
      const bodyStart = offset + header
      const bodyEnd = Math.min(offset + size, e)
      if (type === 'hdlr') {
        const handler = readBoxType(view, bodyStart + 8)
        if (handler === 'vide') found = true
      } else if (type === 'mdia' || type === 'minf') {
        walk(bodyStart, bodyEnd)
      }
      offset += size
    }
  }
  walk(start, end)
  return found
}

function readMdhdTimescale(view: DataView, start: number, end: number): number | null {
  if (start + 20 > end) return null
  const version = view.getUint8(start)
  if (version === 0) {
    return view.getUint32(start + 12)
  }
  if (version === 1 && start + 32 <= end) {
    return view.getUint32(start + 28)
  }
  return null
}

function readSttsTotals(
  view: DataView,
  start: number,
  end: number,
): { samples: number; ticks: number } {
  if (start + 8 > end) return { samples: 0, ticks: 0 }
  const entryCount = view.getUint32(start + 4)
  let samples = 0
  let ticks = 0
  let offset = start + 8
  for (let i = 0; i < entryCount && offset + 8 <= end; i++) {
    const count = view.getUint32(offset)
    const delta = view.getUint32(offset + 4)
    samples += count
    ticks += count * delta
    offset += 8
  }
  return { samples, ticks }
}

function readStszSampleCount(view: DataView, start: number, end: number): number | null {
  if (start + 12 > end) return null
  const sampleCount = view.getUint32(start + 8)
  return sampleCount > 0 ? sampleCount : null
}

function snapCommonFps(fps: number): number {
  const candidates = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 120]
  let best = fps
  let bestDiff = Infinity
  for (const c of candidates) {
    const diff = Math.abs(c - fps)
    if (diff < bestDiff) {
      bestDiff = diff
      best = c
    }
  }
  if (fps < 10) return Math.min(120, Math.max(10, Math.round(fps)))
  const rounded = bestDiff < 0.6 ? Math.round(best) : Math.round(fps)
  return Math.min(120, Math.max(1, rounded))
}

/** 容器帧率与 duration×fps 不一致时，以播放采样为准 */
async function resolveVideoExportFps(
  video: HTMLVideoElement,
  fromFile: Mp4VideoInfo | null,
): Promise<number> {
  const probed = await probeFpsByPlayback(video)
  if (!fromFile || video.duration <= 0) return probed

  const durationFps = fromFile.frameCount / video.duration
  const parsedFps = fromFile.fps

  // 容器样本数与时长对不上（moov 截断 / 误读），不信容器
  if (durationFps < 10 || durationFps > 120) return probed

  if (parsedFps >= 10 && parsedFps <= 120 && Math.abs(parsedFps - probed) < 8) {
    return parsedFps
  }
  if (Math.abs(durationFps - probed) < 8) return snapCommonFps(durationFps)
  return probed
}

async function probeFpsByPlayback(video: HTMLVideoElement): Promise<number> {
  if (!video.requestVideoFrameCallback) return DEFAULT_VIDEO_FPS

  const wasPaused = video.paused
  const prevTime = video.currentTime
  video.currentTime = 0

  try {
    await video.play()
  } catch {
    return DEFAULT_VIDEO_FPS
  }

  type FrameMeta = { presentedFrames: number; mediaTime: number }
  const nextFrame = (): Promise<FrameMeta> =>
    new Promise((resolve, reject) => {
      video.requestVideoFrameCallback((_t, meta) => {
        resolve({ presentedFrames: meta.presentedFrames, mediaTime: meta.mediaTime })
      })
      setTimeout(() => reject(new Error('frame timeout')), 3000)
    })

  try {
    const start = await nextFrame()
    await new Promise((r) => setTimeout(r, 900))
    const end = await nextFrame()
    const dt = end.mediaTime - start.mediaTime
    const df = end.presentedFrames - start.presentedFrames
    if (dt >= 0.25 && df > 0) return snapCommonFps(df / dt)
  } catch {
    /* fall through */
  } finally {
    video.pause()
    video.currentTime = prevTime
    if (!wasPaused) void video.play().catch(() => {})
  }

  return DEFAULT_VIDEO_FPS
}

/** 优先读容器元数据，否则短播采样；导出帧率不低于返回值 */
export async function detectVideoFps(video: HTMLVideoElement, file: File): Promise<number> {
  const fromFile = await parseVideoInfoFromFile(file)
  if (fromFile) return fromFile.fps
  return probeFpsByPlayback(video)
}

/** seek 后等待解码帧真正呈现（rvfc），避免抓到黑帧 */
export function waitForPresentedFrame(video: HTMLVideoElement, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(finish, timeoutMs)
    if (video.requestVideoFrameCallback) {
      video.requestVideoFrameCallback(() => finish())
      return
    }
    requestAnimationFrame(() => requestAnimationFrame(finish))
  })
}

/** 首帧前预热解码器，减少开头黑帧 */
export async function primeVideoDecoder(video: HTMLVideoElement): Promise<void> {
  await seekVideo(video, 0)
  await waitForPresentedFrame(video)
  if (!video.requestVideoFrameCallback) return

  const wasPaused = video.paused
  try {
    await video.play()
    await waitForPresentedFrame(video)
  } catch {
    /* muted autoplay */
  } finally {
    video.pause()
    await seekVideo(video, 0)
    await waitForPresentedFrame(video)
    if (!wasPaused) void video.play().catch(() => {})
  }
}

export function seekVideo(video: HTMLVideoElement, time: number, timeoutMs = 15_000): Promise<void> {
  const maxTime = Math.max(0, (video.duration || 0) - 0.001)
  const target = Math.min(Math.max(time, 0), maxTime)

  if (Math.abs(video.currentTime - target) < 0.001 && video.readyState >= 2) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    let settled = false
    const cleanup = () => {
      settled = true
      clearTimeout(timer)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
    }

    const onSeeked = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('视频定位失败'))
    }
    // ponytail: 个别 MP4 seeked 不触发，超时后继续尝试抓帧
    const timer = setTimeout(() => {
      if (settled) return
      cleanup()
      resolve()
    }, timeoutMs)

    video.addEventListener('seeked', onSeeked)
    video.addEventListener('error', onError)
    video.currentTime = target
  })
}

/** 暂停态 video 上 rvfc 可能永不回调；seek 后用 readyState / loadeddata 判定 */
export function waitForVideoFrame(video: HTMLVideoElement, timeoutMs = 3000): Promise<void> {
  if (video.readyState >= 2) return waitForPresentedFrame(video, timeoutMs)

  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      video.removeEventListener('loadeddata', finish)
      video.removeEventListener('canplay', finish)
      resolve()
    }

    const timer = setTimeout(finish, timeoutMs)
    video.addEventListener('loadeddata', finish, { once: true })
    video.addEventListener('canplay', finish, { once: true })

    // 仅播放中使用 rvfc；暂停 seek 场景不依赖它
    if (!video.paused && video.requestVideoFrameCallback) {
      video.requestVideoFrameCallback(finish)
    }
  })
}

export async function captureVideoFrame(
  video: HTMLVideoElement,
  width: number,
  height: number,
): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')
  ctx.drawImage(video, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}

function isCanvasMostlyBlack(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): boolean {
  const sampleW = Math.min(64, width)
  const sampleH = Math.min(64, height)
  const data = ctx.getImageData(0, 0, sampleW, sampleH).data
  let sum = 0
  for (let i = 0; i < data.length; i += 4) {
    sum += data[i] + data[i + 1] + data[i + 2]
  }
  return sum / (data.length / 4) < 8
}

export async function captureVideoFrameAt(
  video: HTMLVideoElement,
  time: number,
  width: number,
  height: number,
): Promise<string> {
  await seekVideo(video, time)
  await waitForPresentedFrame(video)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')
  ctx.drawImage(video, 0, 0, width, height)

  if (time < 0.05 && isCanvasMostlyBlack(ctx, width, height)) {
    try {
      await video.play()
      await waitForPresentedFrame(video)
      video.pause()
      await seekVideo(video, Math.max(time, 0.001))
      await waitForPresentedFrame(video)
      ctx.drawImage(video, 0, 0, width, height)
    } catch {
      /* 保留首次抓帧结果 */
    }
  }

  return canvas.toDataURL('image/png')
}

export function videoExtensionForMime(mime: string): string {
  return mime.includes('mp4') ? 'mp4' : 'webm'
}

export function clampVideoDuration(duration: number): number {
  return Math.min(duration, MAX_VIDEO_DURATION)
}

export function exportFrameTime(index: number, frameCount: number, duration: number): number {
  const d = clampVideoDuration(duration)
  if (frameCount <= 1) return 0
  return Math.min((index * d) / frameCount, Math.max(d - 0.001, 0))
}

export function computeProcessFrameCount(duration: number, fps: number): number {
  const d = clampVideoDuration(duration)
  return Math.max(1, Math.round(d * fps))
}
