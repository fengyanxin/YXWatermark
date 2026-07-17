import { useCallback, useMemo, useRef, useState } from 'react'
import { CompareVideoPreview } from '@/components/CompareVideoPreview'
import { VideoPlayer } from '@/components/VideoPlayer'
import { MaskEditor, type MaskData } from '@/features/remove-watermark/MaskEditor'
import { useRemoveVideoWatermarkStore } from '@/stores/removeVideoWatermarkStore'
import { captureVideoFrameAt } from '@/lib/utils/video'
import type { ImageFile } from '@/types'

interface VideoMaskEditorProps {
  onMaskChange: (mask: MaskData) => void
}

export function VideoMaskEditor({ onMaskChange }: VideoMaskEditorProps) {
  const video = useRemoveVideoWatermarkStore((s) => s.video)
  const previewFrameUrl = useRemoveVideoWatermarkStore((s) => s.previewFrameUrl)
  const previewTime = useRemoveVideoWatermarkStore((s) => s.previewTime)
  const frameResultUrl = useRemoveVideoWatermarkStore((s) => s.frameResultUrl)
  const resultVideoUrl = useRemoveVideoWatermarkStore((s) => s.resultVideoUrl)
  const previewMode = useRemoveVideoWatermarkStore((s) => s.previewMode)
  const maskTool = useRemoveVideoWatermarkStore((s) => s.maskTool)
  const brushSize = useRemoveVideoWatermarkStore((s) => s.brushSize)
  const comparePosition = useRemoveVideoWatermarkStore((s) => s.comparePosition)
  const setPreviewFrameUrl = useRemoveVideoWatermarkStore((s) => s.setPreviewFrameUrl)
  const setPreviewTime = useRemoveVideoWatermarkStore((s) => s.setPreviewTime)
  const setPreviewMode = useRemoveVideoWatermarkStore((s) => s.setPreviewMode)
  const setComparePosition = useRemoveVideoWatermarkStore((s) => s.setComparePosition)
  const setFrameResultUrl = useRemoveVideoWatermarkStore((s) => s.setFrameResultUrl)

  const playerVideoRef = useRef<HTMLVideoElement>(null)
  const captureSeq = useRef(0)
  const syncingFrame = useRef(false)
  const [loadingFrame, setLoadingFrame] = useState(false)

  const captureAt = useCallback(
    async (time: number) => {
      const el = playerVideoRef.current
      if (!video || !el) return

      syncingFrame.current = true
      el.pause()
      const seq = ++captureSeq.current
      setLoadingFrame(true)
      try {
        const frameUrl = await captureVideoFrameAt(el, time, video.width, video.height)
        if (seq !== captureSeq.current) return
        setFrameResultUrl(null)
        setPreviewFrameUrl(frameUrl)
        setPreviewTime(el.currentTime)
      } finally {
        syncingFrame.current = false
        if (seq === captureSeq.current) setLoadingFrame(false)
      }
    },
    [video, setPreviewFrameUrl, setPreviewTime, setFrameResultUrl],
  )

  const handlePause = useCallback(
    (time: number) => {
      if (syncingFrame.current) return
      captureAt(time)
    },
    [captureAt],
  )

  const handlePlayerLoaded = useCallback(
    (el: HTMLVideoElement) => {
      playerVideoRef.current = el
      el.currentTime = 0
      if (video?.firstFrameUrl && previewFrameUrl === video.firstFrameUrl) return
      captureAt(0)
    },
    [captureAt, video?.firstFrameUrl, previewFrameUrl],
  )

  const frameImage: ImageFile | null = useMemo(() => {
    if (!video || !previewFrameUrl) return null
    return {
      file: video.file,
      url: previewFrameUrl,
      width: video.width,
      height: video.height,
    }
  }, [video, previewFrameUrl])

  if (!video) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center rounded-xl border border-[var(--color-border)] bg-[#1e293b]/5 p-4">
        <div className="text-center text-[var(--color-muted)]">
          <p className="text-4xl mb-3 opacity-40">🎬</p>
          <p className="text-sm">上传视频后预览并标记水印区域</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[#1e293b]/5 p-4">
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setPreviewMode('mark')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            previewMode === 'mark'
              ? 'bg-white text-teal-brand shadow-sm'
              : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          标记 / 帧预览
        </button>
        <button
          type="button"
          onClick={() => setPreviewMode('video-result')}
          disabled={!resultVideoUrl}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
            previewMode === 'video-result'
              ? 'bg-white text-teal-brand shadow-sm'
              : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          视频效果对比
        </button>
      </div>

      {previewMode === 'video-result' && resultVideoUrl ? (
        <CompareVideoPreview
          originalSrc={video.url}
          resultSrc={resultVideoUrl}
          width={video.width}
          height={video.height}
          comparePosition={comparePosition}
          onComparePositionChange={setComparePosition}
        />
      ) : (
        <>
          <div className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3">
            <div className="mb-2 flex items-center justify-between text-xs text-[var(--color-muted)]">
              <span>原视频预览 — 默认首帧，拖动进度条或暂停可切换标记帧</span>
              {loadingFrame && <span>同步帧…</span>}
            </div>
            <VideoPlayer
              ref={playerVideoRef}
              src={video.url}
              width={video.width}
              height={video.height}
              onLoaded={handlePlayerLoaded}
              onSeek={(t) => captureAt(t)}
              onPause={handlePause}
            />
          </div>

          <div>
            <p className="mb-2 text-xs text-[var(--color-muted)]">
              {frameResultUrl
                ? '当前帧修复预览 — 拖动对比线查看效果'
                : `标记区域（首帧 ${previewTime.toFixed(1)}s）— 框选水印后点击「预览当前帧」`}
            </p>
            <MaskEditor
              image={frameImage}
              resultUrl={frameResultUrl}
              maskTool={maskTool}
              brushSize={brushSize}
              comparePosition={comparePosition}
              onMaskChange={onMaskChange}
            />
          </div>
        </>
      )}
    </div>
  )
}

export type { MaskData }
