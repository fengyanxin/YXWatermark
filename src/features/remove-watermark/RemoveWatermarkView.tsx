import { useCallback, useState } from 'react'
import { ImageUpload } from '@/components/ImageUpload'
import { MaskEditor, type MaskData } from '@/features/remove-watermark/MaskEditor'
import { RemoveControls } from '@/features/remove-watermark/RemoveControls'
import { useRemoveWatermarkStore } from '@/stores/removeWatermarkStore'

const emptyMask: MaskData = { lines: [], rects: [] }

export function RemoveWatermarkView() {
  const image = useRemoveWatermarkStore((s) => s.image)
  const resultUrl = useRemoveWatermarkStore((s) => s.resultUrl)
  const maskTool = useRemoveWatermarkStore((s) => s.maskTool)
  const brushSize = useRemoveWatermarkStore((s) => s.brushSize)
  const comparePosition = useRemoveWatermarkStore((s) => s.comparePosition)
  const setImage = useRemoveWatermarkStore((s) => s.setImage)
  const [maskData, setMaskData] = useState<MaskData>(emptyMask)

  const handleMaskChange = useCallback((mask: MaskData) => {
    setMaskData(mask)
  }, [])

  const handleImageChange = useCallback(
    (img: Parameters<typeof setImage>[0]) => {
      setImage(img)
      setMaskData(emptyMask)
    },
    [setImage],
  )

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr_280px] gap-4">
        <aside className="overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white p-4">
          <ImageUpload image={image} onImage={handleImageChange} label="上传待处理图片" />
        </aside>

        <main className="min-w-0">
          <MaskEditor
            image={image}
            resultUrl={resultUrl}
            maskTool={maskTool}
            brushSize={brushSize}
            comparePosition={comparePosition}
            onMaskChange={handleMaskChange}
          />
        </main>

        <aside className="overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white p-4">
          <RemoveControls maskData={maskData} />
        </aside>
      </div>
    </div>
  )
}
