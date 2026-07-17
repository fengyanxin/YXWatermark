import { useCallback, useEffect, useRef, useState } from 'react'
import { PanelSection, SliderField } from '@/components/PanelSection'
import { useVideoDisplaySize } from '@/components/VideoPlayer'

interface CompareVideoPreviewProps {
  originalSrc: string
  resultSrc: string
  width: number
  height: number
  comparePosition: number
  onComparePositionChange: (pos: number) => void
}

function formatTime(seconds: number) {
  const s = Math.floor(seconds % 60)
  const m = Math.floor(seconds / 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function CompareVideoPreview({
  originalSrc,
  resultSrc,
  width,
  height,
  comparePosition,
  onComparePositionChange,
}: CompareVideoPreviewProps) {
  const origRef = useRef<HTMLVideoElement>(null)
  const resultRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const { displayW, displayH } = useVideoDisplaySize(width, height)

  const syncTime = useCallback((t: number) => {
    if (origRef.current) origRef.current.currentTime = t
    if (resultRef.current) resultRef.current.currentTime = t
    setTime(t)
  }, [])

  useEffect(() => {
    setPlaying(false)
    setTime(0)
  }, [originalSrc, resultSrc])

  const togglePlay = useCallback(async () => {
    const orig = origRef.current
    const result = resultRef.current
    if (!orig || !result) return

    if (orig.paused) {
      await Promise.all([orig.play(), result.play()])
      setPlaying(true)
    } else {
      orig.pause()
      result.pause()
      setPlaying(false)
    }
  }, [])

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
        拖动对比线查看修复前后效果，点击下方播放预览完整视频
      </div>

      <div
        className="relative mx-auto overflow-hidden rounded-lg bg-black/90"
        style={{ width: displayW, height: displayH }}
      >
        <video
          ref={origRef}
          src={originalSrc}
          className="absolute inset-0 h-full w-full object-contain"
          playsInline
          muted
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime
            if (resultRef.current && Math.abs(resultRef.current.currentTime - t) > 0.1) {
              resultRef.current.currentTime = t
            }
            setTime(t)
          }}
          onEnded={() => setPlaying(false)}
        />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 0 0 ${comparePosition}%)` }}
        >
          <video
            ref={resultRef}
            src={resultSrc}
            className="h-full w-full object-contain"
            playsInline
            muted
            onEnded={() => setPlaying(false)}
          />
        </div>
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-amber-accent shadow-lg"
          style={{ left: `${comparePosition}%` }}
        />
        {!playing && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20 text-white"
            aria-label="播放对比"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-2xl text-teal-brand shadow-lg">
              ▶
            </span>
          </button>
        )}
        <span className="absolute left-2 top-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
          原视频
        </span>
        <span className="absolute right-2 top-2 rounded bg-teal-brand/80 px-2 py-0.5 text-xs text-white">
          修复后
        </span>
      </div>

      <PanelSection title="前后对比">
        <SliderField
          label="对比位置"
          value={comparePosition}
          min={0}
          max={100}
          unit="%"
          onChange={onComparePositionChange}
        />
      </PanelSection>

      <div className="mx-auto w-full max-w-xl space-y-1 px-1">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.05}
          value={time}
          onChange={(e) => syncTime(Number(e.target.value))}
          className="w-full accent-teal-brand"
        />
        <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
          <button
            type="button"
            onClick={togglePlay}
            className="rounded-md border border-[var(--color-border)] px-2.5 py-1 hover:bg-slate-50"
          >
            {playing ? '暂停' : '播放'}
          </button>
          <span>
            {formatTime(time)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  )
}
