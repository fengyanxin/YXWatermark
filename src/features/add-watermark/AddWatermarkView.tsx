import { ImageUpload } from '@/components/ImageUpload'
import { WatermarkPreview } from '@/features/add-watermark/WatermarkPreview'
import { WatermarkControls } from '@/features/add-watermark/WatermarkControls'
import { useAddWatermarkStore } from '@/stores/addWatermarkStore'
import { useAppStore } from '@/stores/appStore'
import { exportWatermarkedImage } from '@/lib/canvas/watermarkRenderer'
import { useSaveImage } from '@/hooks/useSaveImage'

export function AddWatermarkView() {
  const image = useAddWatermarkStore((s) => s.image)
  const config = useAddWatermarkStore((s) => s.config)
  const exportFormat = useAddWatermarkStore((s) => s.exportFormat)
  const jpegQuality = useAddWatermarkStore((s) => s.jpegQuality)
  const setImage = useAddWatermarkStore((s) => s.setImage)
  const showToast = useAppStore((s) => s.showToast)
  const { saveImage } = useSaveImage()

  const handleExport = async () => {
    if (!image) {
      showToast('请先上传图片')
      return
    }
    if (!config.text.enabled && !config.logo.enabled) {
      showToast('请至少启用一种水印')
      return
    }
    try {
      const dataUrl = await exportWatermarkedImage(
        image.url,
        image.width,
        image.height,
        config,
        exportFormat,
        jpegQuality,
      )
      const ext = exportFormat === 'png' ? 'png' : 'jpg'
      const baseName = image.file.name.replace(/\.[^.]+$/, '')
      await saveImage(dataUrl, `${baseName}-watermarked.${ext}`)
    } catch {
      showToast('导出失败，请重试')
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr_280px] gap-4">
        <aside className="overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white p-4">
          <ImageUpload image={image} onImage={setImage} label="上传原图" />
        </aside>

        <main className="min-w-0">
          <WatermarkPreview />
        </main>

        <aside className="overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white p-4">
          <WatermarkControls />
        </aside>
      </div>

      <div className="flex justify-center pb-2">
        <button
          type="button"
          onClick={handleExport}
          disabled={!image}
          className="rounded-xl bg-teal-brand px-8 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-teal-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          保存图片
        </button>
      </div>
    </div>
  )
}
