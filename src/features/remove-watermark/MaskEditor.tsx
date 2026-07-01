import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Line, Rect } from 'react-konva'
import type Konva from 'konva'
import type { ImageFile, MaskTool } from '@/types'

const PREVIEW_MAX = 720

export interface MaskData {
  lines: { points: number[]; strokeWidth: number }[]
  rects: { x: number; y: number; width: number; height: number }[]
}

interface MaskEditorProps {
  image: ImageFile | null
  resultUrl: string | null
  maskTool: MaskTool
  brushSize: number
  comparePosition: number
  onMaskChange: (mask: MaskData) => void
  readOnly?: boolean
}

export function MaskEditor({
  image,
  resultUrl,
  maskTool,
  brushSize,
  comparePosition,
  onMaskChange,
  readOnly = false,
}: MaskEditorProps) {
  const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null)
  const [resultImage, setResultImage] = useState<HTMLImageElement | null>(null)
  const [lines, setLines] = useState<MaskData['lines']>([])
  const [rects, setRects] = useState<MaskData['rects']>([])
  const isDrawing = useRef(false)
  const isRectDrawing = useRef(false)
  const rectStart = useRef<{ x: number; y: number } | null>(null)
  const draftRectRef = useRef<MaskData['rects'][0] | null>(null)
  const stageRef = useRef<Konva.Stage | null>(null)
  const [draftRect, setDraftRect] = useState<MaskData['rects'][0] | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(600)

  useEffect(() => {
    onMaskChange({ lines, rects })
  }, [lines, rects, onMaskChange])

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
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
    setLines([])
    setRects([])
  }, [image])

  useEffect(() => {
    if (!resultUrl) {
      setResultImage(null)
      return
    }
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setResultImage(img)
    img.src = resultUrl
  }, [resultUrl])

  const scale = image
    ? Math.min(1, PREVIEW_MAX / Math.max(image.width, image.height))
    : 1

  const stageWidth = image ? image.width * scale : containerWidth
  const stageHeight = image ? image.height * scale : 400

  const updateDraftRect = (next: MaskData['rects'][0] | null) => {
    draftRectRef.current = next
    setDraftRect(next)
  }

  const getImageCoords = (clientX: number, clientY: number) => {
    const stage = stageRef.current
    if (!stage) return null
    const box = stage.container().getBoundingClientRect()
    return {
      x: (clientX - box.left) / scale,
      y: (clientY - box.top) / scale,
    }
  }

  const finishRectDrawing = () => {
    if (!isRectDrawing.current) return
    const rect = draftRectRef.current
    if (rect && rect.width > 2 && rect.height > 2) {
      setRects((prev) => [...prev, rect])
    }
    isRectDrawing.current = false
    rectStart.current = null
    updateDraftRect(null)
  }

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (readOnly || !image || resultUrl) return
    // 仅响应左键，避免右键误触
    if ('button' in e.evt && e.evt.button !== 0) return

    const stage = e.target.getStage()
    if (!stage) return
    const pos = stage.getPointerPosition()
    if (!pos) return
    const coords = { x: pos.x / scale, y: pos.y / scale }

    if (maskTool === 'brush') {
      isDrawing.current = true
      setLines((prev) => [
        ...prev,
        { points: [coords.x, coords.y], strokeWidth: brushSize },
      ])
    } else {
      isRectDrawing.current = true
      rectStart.current = coords
      updateDraftRect({ x: coords.x, y: coords.y, width: 0, height: 0 })

      const onWindowMove = (ev: MouseEvent) => {
        const start = rectStart.current
        if (!start) return
        const current = getImageCoords(ev.clientX, ev.clientY)
        if (!current) return
        updateDraftRect({
          x: Math.min(start.x, current.x),
          y: Math.min(start.y, current.y),
          width: Math.abs(current.x - start.x),
          height: Math.abs(current.y - start.y),
        })
      }

      const onWindowUp = () => {
        window.removeEventListener('mousemove', onWindowMove)
        window.removeEventListener('mouseup', onWindowUp)
        finishRectDrawing()
      }

      window.addEventListener('mousemove', onWindowMove)
      window.addEventListener('mouseup', onWindowUp)
    }
  }

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (readOnly || !image || maskTool !== 'brush' || !isDrawing.current) return
    const stage = e.target.getStage()
    if (!stage) return
    const pos = stage.getPointerPosition()
    if (!pos) return
    const coords = { x: pos.x / scale, y: pos.y / scale }

    setLines((prev) => {
      const last = prev[prev.length - 1]
      if (!last) return prev
      return [...prev.slice(0, -1), { ...last, points: [...last.points, coords.x, coords.y] }]
    })
  }

  const handleMouseUp = () => {
    if (maskTool === 'rect') return
    isDrawing.current = false
  }

  const displayImage = resultImage ?? baseImage
  const showCompare = resultImage && baseImage

  return (
    <div
      ref={containerRef}
      className="relative flex h-full min-h-[400px] items-center justify-center overflow-auto rounded-xl border border-[var(--color-border)] bg-[#1e293b]/5 p-4"
    >
      {!image || !baseImage ? (
        <div className="text-center text-[var(--color-muted)]">
          <p className="text-4xl mb-3 opacity-40">✨</p>
          <p className="text-sm">上传图片后标记水印区域</p>
        </div>
      ) : (
        <div className="relative" style={{ width: stageWidth, height: stageHeight }}>
          {showCompare ? (
            <>
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}
              >
                <Stage width={stageWidth} height={stageHeight} scaleX={scale} scaleY={scale}>
                  <Layer>
                    <KonvaImage image={baseImage} width={image.width} height={image.height} />
                  </Layer>
                </Stage>
              </div>
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 0 0 ${comparePosition}%)` }}
              >
                <Stage width={stageWidth} height={stageHeight} scaleX={scale} scaleY={scale}>
                  <Layer>
                    <KonvaImage image={resultImage} width={image.width} height={image.height} />
                  </Layer>
                </Stage>
              </div>
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-accent shadow-lg"
                style={{ left: `${comparePosition}%` }}
              />
            </>
          ) : (
            <Stage
              ref={stageRef}
              width={stageWidth}
              height={stageHeight}
              scaleX={scale}
              scaleY={scale}
              onMouseDown={handleMouseDown}
              onMousemove={handleMouseMove}
              onMouseup={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchMove={handleMouseMove}
              onTouchEnd={handleMouseUp}
            >
              <Layer>
                <KonvaImage
                  image={displayImage ?? baseImage}
                  width={image.width}
                  height={image.height}
                />
              </Layer>
              {!readOnly && !resultUrl && (
                <Layer opacity={0.5} listening={false}>
                  {lines.map((line, i) => (
                    <Line
                      key={`line-${i}`}
                      points={line.points}
                      stroke="#F59E0B"
                      strokeWidth={line.strokeWidth}
                      lineCap="round"
                      lineJoin="round"
                      globalCompositeOperation="source-over"
                      listening={false}
                    />
                  ))}
                  {rects.map((rect, i) => (
                    <Rect
                      key={`rect-${i}`}
                      {...rect}
                      fill="rgba(245, 158, 11, 0.5)"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      listening={false}
                    />
                  ))}
                  {draftRect && (
                    <Rect
                      {...draftRect}
                      fill="rgba(245, 158, 11, 0.3)"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      dash={[6, 4]}
                      listening={false}
                    />
                  )}
                </Layer>
              )}
            </Stage>
          )}
        </div>
      )}
    </div>
  )
}

export function clearMaskRef() {
  /* placeholder for external reset if needed */
}
