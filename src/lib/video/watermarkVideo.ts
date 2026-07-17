import type { WatermarkConfig } from '@/types'
import {
  drawWatermarksOnContextSync,
  preloadWatermarkAssets,
} from '@/lib/canvas/watermarkRenderer'
import { exportVideo, drawVideoFrameSharp, type VideoExportFormat } from '@/lib/video/frameEncoder'
import {
  computeProcessFrameCount,
  loadVideoElement,
  mountOffscreenVideo,
  seekVideo,
  waitForPresentedFrame,
} from '@/lib/utils/video'

export interface VideoExportProgress {
  phase: 'encoding'
  progress: number
}

/** 逐帧同步导出；WebM 保留音轨，MP4 视浏览器而定 */
export async function exportWatermarkedVideo(
  videoUrl: string,
  width: number,
  height: number,
  fps: number,
  config: WatermarkConfig,
  format: VideoExportFormat,
  onProgress?: (p: VideoExportProgress) => void,
): Promise<{ blob: Blob; mimeType: string; format: VideoExportFormat; hasAudio: boolean }> {
  await preloadWatermarkAssets(config)
  const video = await loadVideoElement(videoUrl)
  const unmount = mountOffscreenVideo(video)

  const exportWidth = video.videoWidth || width
  const exportHeight = video.videoHeight || height
  const exportDuration = video.duration
  const exportFps = Math.max(1, fps)

  const useSeekMp4 =
    format === 'mp4' &&
    !['video/mp4', 'video/mp4; codecs=avc1.42E01E', 'video/mp4;codecs=avc1'].some((t) =>
      MediaRecorder.isTypeSupported(t),
    )

  const drawFrame = (ctx: CanvasRenderingContext2D) => {
    drawVideoFrameSharp(ctx, video, exportWidth, exportHeight)
    drawWatermarksOnContextSync(ctx, exportWidth, exportHeight, config)
  }

  try {
    const result = await exportVideo({
      width: exportWidth,
      height: exportHeight,
      duration: exportDuration,
      fps: exportFps,
      frameCount: computeProcessFrameCount(exportDuration, exportFps),
      format,
      mode: useSeekMp4 ? 'seek' : 'playback',
      playbackVideo: useSeekMp4 ? undefined : video,
      renderFrame: async (ctx, time) => {
        if (useSeekMp4) {
          await seekVideo(video, time)
          await waitForPresentedFrame(video)
        }
        drawFrame(ctx)
      },
      onProgress: (p) => onProgress?.({ phase: 'encoding', progress: p }),
    })

    return {
      blob: result.blob,
      mimeType: result.mimeType,
      format: result.format,
      hasAudio: result.hasAudio,
    }
  } finally {
    unmount()
  }
}
