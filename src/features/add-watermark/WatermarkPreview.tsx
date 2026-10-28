import { useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Text, Group } from 'react-konva'
import type Konva from 'konva'
import { useAddWatermarkStore } from '@/stores/addWatermarkStore'
import { computePreviewScale, gridPositionToCoords } from '@/lib/utils/image'

const PREVIEW_MAX = 720
const PREVIEW_PADDING = 32

export function WatermarkPreview() {
  const image = useAddWatermarkStore((s) => s.image)
  const config = useAddWatermarkStore((s) => s.config)
  const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null)
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 600, height: 480 })

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      setContainerSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!image) {
      setBaseImage(null)
      return
    }
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setBaseImage(img)
    img.src = image.url
  }, [image])

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

  const scale = useMemo(() => {
    if (!image) return 1
    return computePreviewScale(
      image.width,
      image.height,
      containerSize.width,
      containerSize.height,
      PREVIEW_MAX,
      PREVIEW_PADDING,
    )
  }, [image, containerSize.width, containerSize.height])

  const stageWidth = image ? image.width * scale : containerSize.width - PREVIEW_PADDING
  const stageHeight = image ? image.height * scale : 400

  const tiledTexts = useMemo(() => {
    if (!image || !config.tile.enabled || !config.text.enabled) return []
    const items: { x: number; y: number }[] = []
    const spacingX = Math.max(config.tile.spacingX, config.text.fontSize * 2) * scale
    const spacingY = Math.max(config.tile.spacingY, config.text.fontSize * 2) * scale
    const diag = Math.sqrt(stageWidth ** 2 + stageHeight ** 2)
    for (let y = -diag; y <= diag; y += spacingY) {
      for (let x = -diag; x <= diag; x += spacingX) {
        items.push({ x, y })
      }
    }
    return items
  }, [image, config.tile, config.text, scale, stageWidth, stageHeight])

  const tiledLogos = useMemo(() => {
    if (!image || !config.tile.enabled || !config.logo.enabled || !logoImage) return []
    const w = (logoImage.width * config.logo.scale * scale) / 100
    const h = (logoImage.height * config.logo.scale * scale) / 100
    const spacingX = Math.max(config.tile.spacingX, w + 20)
    const spacingY = Math.max(config.tile.spacingY, h + 20)
    const items: { x: number; y: number }[] = []
    const diag = Math.sqrt(stageWidth ** 2 + stageHeight ** 2)
    for (let y = -diag; y <= diag; y += spacingY) {
      for (let x = -diag; x <= diag; x += spacingX) {
        items.push({ x, y })
      }
    }
    return items
  }, [image, config.tile, config.logo, logoImage, scale, stageWidth, stageHeight])

  const textPos = image
    ? gridPositionToCoords(
        config.text.position,
        image.width,
        image.height,
        config.text.offsetX,
        config.text.offsetY,
      )
    : null

  const logoPos = image
    ? gridPositionToCoords(
        config.logo.position,
        image.width,
        image.height,
        config.logo.offsetX,
        config.logo.offsetY,
      )
    : null

  return (
    <div
      ref={containerRef}
      className="flex h-full min-h-0 items-center justify-center overflow-auto rounded-xl border border-[var(--color-border)] bg-[#1e293b]/5 p-4"
    >
      {!image || !baseImage ? (
        <div className="text-center text-[var(--color-muted)]">
          <p className="text-4xl mb-3 opacity-40">🖼</p>
          <p className="text-sm">上传图片后在此预览水印效果</p>
        </div>
      ) : (
        <div className="shrink-0" style={{ width: stageWidth, height: stageHeight }}>
        <Stage width={stageWidth} height={stageHeight} scaleX={scale} scaleY={scale}>
          <Layer>
            <KonvaImage image={baseImage} width={image.width} height={image.height} />
          </Layer>
          <Layer>
            {config.tile.enabled ? (
              <Group
                x={image.width / 2}
                y={image.height / 2}
                rotation={config.tile.rotation}
              >
                {config.text.enabled &&
                  tiledTexts.map((t, i) => (
                    <Text
                      key={`t-${i}`}
                      x={t.x / scale - image.width / 2}
                      y={t.y / scale - image.height / 2}
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
                      x={t.x / scale - image.width / 2}
                      y={t.y / scale - image.height / 2}
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
      )}
    </div>
  )
}

export type WatermarkPreviewStage = Konva.Stage
