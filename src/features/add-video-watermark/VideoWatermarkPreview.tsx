import { useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Text, Group } from 'react-konva'
import { useAddVideoWatermarkStore } from '@/stores/addVideoWatermarkStore'
import { gridPositionToCoords } from '@/lib/utils/image'
import { useVideoDisplaySize } from '@/components/VideoPlayer'

export function VideoWatermarkPreview() {
  const video = useAddVideoWatermarkStore((s) => s.video)
  const config = useAddVideoWatermarkStore((s) => s.config)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const { displayW, displayH, scale } = useVideoDisplaySize(
    video?.width ?? 640,
    video?.height ?? 360,
  )

  useEffect(() => {
    setPlaying(false)
    setTime(0)
    setDuration(0)
  }, [video?.url])

  useEffect(() => {
    if (!config.logo.imageUrl) {
      setLogoImage(null)
      return
    }
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setLogoImage(img)
    img.src = config.logo.imageUrl
  }, [config.logo.imageUrl])

  const togglePlay = async () => {
    const el = videoRef.current
    if (!el) return
    if (el.paused) {
      await el.play()
      setPlaying(true)
    } else {
      el.pause()
      setPlaying(false)
    }
  }

  const handleSeek = (next: number) => {
    const el = videoRef.current
    if (!el) return
    el.currentTime = next
    setTime(next)
  }

  const formatTime = (seconds: number) => {
    const s = Math.floor(seconds % 60)
    const m = Math.floor(seconds / 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const tiledTexts = useMemo(() => {
    if (!video || !config.tile.enabled || !config.text.enabled) return []
    const items: { x: number; y: number }[] = []
    const spacingX = Math.max(config.tile.spacingX, config.text.fontSize * 2) * scale
    const spacingY = Math.max(config.tile.spacingY, config.text.fontSize * 2) * scale
    const diag = Math.sqrt(displayW ** 2 + displayH ** 2)
    for (let y = -diag; y <= diag; y += spacingY) {
      for (let x = -diag; x <= diag; x += spacingX) {
        items.push({ x, y })
      }
    }
    return items
  }, [video, config.tile, config.text, scale, displayW, displayH])

  const tiledLogos = useMemo(() => {
    if (!video || !config.tile.enabled || !config.logo.enabled || !logoImage) return []
    const w = (logoImage.width * config.logo.scale * scale) / 100
    const h = (logoImage.height * config.logo.scale * scale) / 100
    const spacingX = Math.max(config.tile.spacingX, w + 20)
    const spacingY = Math.max(config.tile.spacingY, h + 20)
    const items: { x: number; y: number }[] = []
    const diag = Math.sqrt(displayW ** 2 + displayH ** 2)
    for (let y = -diag; y <= diag; y += spacingY) {
      for (let x = -diag; x <= diag; x += spacingX) {
        items.push({ x, y })
      }
    }
    return items
  }, [video, config.tile, config.logo, logoImage, scale, displayW, displayH])

  const textPos = video
    ? gridPositionToCoords(
        config.text.position,
        video.width,
        video.height,
        config.text.offsetX,
        config.text.offsetY,
      )
    : null

  const logoPos = video
    ? gridPositionToCoords(
        config.logo.position,
        video.width,
        video.height,
        config.logo.offsetX,
        config.logo.offsetY,
      )
    : null

  return (
    <div
      ref={containerRef}
      className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 overflow-auto rounded-xl border border-[var(--color-border)] bg-[#1e293b]/5 p-4"
    >
      {!video ? (
        <div className="text-center text-[var(--color-muted)]">
          <p className="text-4xl mb-3 opacity-40">🎬</p>
          <p className="text-sm">上传视频后在此实时预览水印效果</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-[var(--color-muted)]">
            播放视频查看水印动态效果，右侧调整参数实时更新
          </p>

          <div
            className="relative overflow-hidden rounded-lg bg-black/90 shadow-md"
            style={{ width: displayW, height: displayH }}
          >
            <video
              ref={videoRef}
              src={video.url}
              className="block h-full w-full object-contain"
              playsInline
              muted
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              onEnded={() => setPlaying(false)}
              onClick={togglePlay}
            />
            <div className="pointer-events-none absolute inset-0">
              <Stage width={displayW} height={displayH} scaleX={scale} scaleY={scale}>
                <Layer>
                  {config.tile.enabled ? (
                    <Group
                      x={video.width / 2}
                      y={video.height / 2}
                      rotation={config.tile.rotation}
                    >
                      {config.text.enabled &&
                        tiledTexts.map((t, i) => (
                          <Text
                            key={`t-${i}`}
                            x={t.x / scale - video.width / 2}
                            y={t.y / scale - video.height / 2}
                            text={config.text.text}
                            fontSize={config.text.fontSize}
                            fill={config.text.color}
                            opacity={config.text.opacity / 100}
                            fontFamily="Noto Sans SC, DM Sans, sans-serif"
                            fontStyle="600"
                            offsetX={config.text.fontSize * config.text.text.length * 0.25}
                            offsetY={config.text.fontSize / 2}
                          />
                        ))}
                      {config.logo.enabled &&
                        logoImage &&
                        tiledLogos.map((t, i) => (
                          <KonvaImage
                            key={`l-${i}`}
                            x={t.x / scale - video.width / 2}
                            y={t.y / scale - video.height / 2}
                            image={logoImage}
                            width={(logoImage.width * config.logo.scale) / 100}
                            height={(logoImage.height * config.logo.scale) / 100}
                            opacity={config.logo.opacity / 100}
                            offsetX={(logoImage.width * config.logo.scale) / 200}
                            offsetY={(logoImage.height * config.logo.scale) / 200}
                          />
                        ))}
                    </Group>
                  ) : (
                    <>
                      {config.text.enabled && textPos && (
                        <Text
                          x={textPos.x}
                          y={textPos.y}
                          text={config.text.text}
                          fontSize={config.text.fontSize}
                          fill={config.text.color}
                          opacity={config.text.opacity / 100}
                          rotation={config.text.rotation}
                          fontFamily="Noto Sans SC, DM Sans, sans-serif"
                          fontStyle="600"
                          offsetX={config.text.fontSize * config.text.text.length * 0.25}
                          offsetY={config.text.fontSize / 2}
                        />
                      )}
                      {config.logo.enabled && logoImage && logoPos && (
                        <KonvaImage
                          x={logoPos.x}
                          y={logoPos.y}
                          image={logoImage}
                          width={(logoImage.width * config.logo.scale) / 100}
                          height={(logoImage.height * config.logo.scale) / 100}
                          opacity={config.logo.opacity / 100}
                          rotation={config.logo.rotation}
                          offsetX={(logoImage.width * config.logo.scale) / 200}
                          offsetY={(logoImage.height * config.logo.scale) / 200}
                        />
                      )}
                    </>
                  )}
                </Layer>
              </Stage>
            </div>
            {!playing && (
              <button
                type="button"
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/20 text-white"
                aria-label="播放预览"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-2xl text-teal-brand shadow-lg">
                  ▶
                </span>
              </button>
            )}
          </div>

          <div className="w-full max-w-xl space-y-1 px-1">
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
                className="rounded-md border border-[var(--color-border)] bg-white px-2.5 py-1 hover:bg-slate-50"
              >
                {playing ? '暂停' : '播放'}
              </button>
              <span>
                {formatTime(time)} / {formatTime(duration)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
