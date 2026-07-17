import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'

interface VideoPlayerProps {
  src: string
  width: number
  height: number
  maxDisplaySize?: number
  label?: string
  /** 外部控制播放时间（如与标记帧同步） */
  seekTo?: number | null
  onTimeUpdate?: (time: number) => void
  onSeek?: (time: number) => void
  onPause?: (time: number) => void
  onLoaded?: (video: HTMLVideoElement) => void
  className?: string
}

function formatTime(seconds: number) {
  const s = Math.floor(seconds % 60)
  const m = Math.floor(seconds / 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(function VideoPlayer(
  {
    src,
    width,
    height,
    maxDisplaySize = 720,
    label,
    seekTo,
    onTimeUpdate,
    onSeek,
    onPause,
    onLoaded,
    className = '',
  },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null)
  useImperativeHandle(ref, () => videoRef.current!)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const { displayW, displayH } = useMemo(() => {
    const maxDim = Math.max(width, height)
    const s = maxDim <= maxDisplaySize ? 1 : maxDisplaySize / maxDim
    return { displayW: width * s, displayH: height * s }
  }, [width, height, maxDisplaySize])

  useEffect(() => {
    setPlaying(false)
    setTime(0)
    setDuration(0)
  }, [src])

  useEffect(() => {
    if (seekTo == null || !videoRef.current) return
    const el = videoRef.current
    if (Math.abs(el.currentTime - seekTo) < 0.05) return
    el.currentTime = seekTo
    setTime(seekTo)
  }, [seekTo])

  const togglePlay = useCallback(async () => {
    const el = videoRef.current
    if (!el) return
    if (el.paused) {
      await el.play()
      setPlaying(true)
    } else {
      el.pause()
      setPlaying(false)
    }
  }, [])

  const handleSeek = useCallback(
    (next: number) => {
      const el = videoRef.current
      if (!el) return
      el.currentTime = next
      setTime(next)
      onSeek?.(next)
    },
    [onSeek],
  )

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <p className="text-xs font-medium text-[var(--color-muted)]">{label}</p>
      )}
      <div
        className="relative mx-auto overflow-hidden rounded-lg bg-black/90"
        style={{ width: displayW, height: displayH }}
      >
        <video
          ref={videoRef}
          src={src}
          className="block h-full w-full object-contain"
          playsInline
          muted
          preload="auto"
          crossOrigin="anonymous"
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration)
            onLoaded?.(e.currentTarget)
          }}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime
            setTime(t)
            onTimeUpdate?.(t)
          }}
          onPause={(e) => {
            setPlaying(false)
            onPause?.(e.currentTarget.currentTime)
          }}
          onEnded={() => setPlaying(false)}
          onClick={togglePlay}
        />
        {!playing && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20 text-white transition-opacity hover:bg-black/30"
            aria-label="播放"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-2xl text-teal-brand shadow-lg">
              ▶
            </span>
          </button>
        )}
      </div>

      <div className="mx-auto w-full max-w-xl space-y-1 px-1">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.05}
          value={time}
          onChange={(e) => handleSeek(Number(e.target.value))}
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
})

export function useVideoDisplaySize(width: number, height: number, maxDisplaySize = 720) {
  return useMemo(() => {
    const maxDim = Math.max(width, height)
    const scale = maxDim <= maxDisplaySize ? 1 : maxDisplaySize / maxDim
    return { displayW: width * scale, displayH: height * scale, scale }
  }, [width, height, maxDisplaySize])
}
