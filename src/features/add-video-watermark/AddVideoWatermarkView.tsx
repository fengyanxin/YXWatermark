import { VideoUpload } from '@/components/VideoUpload'
import { VideoWatermarkPreview } from '@/features/add-video-watermark/VideoWatermarkPreview'
import { WatermarkControls } from '@/features/add-watermark/WatermarkControls'
import { useAddVideoWatermarkStore } from '@/stores/addVideoWatermarkStore'
import { useAppStore } from '@/stores/appStore'
import { DEFAULT_VIDEO_FPS } from '@/types'
import { exportWatermarkedVideo } from '@/lib/video/watermarkVideo'
import { useSaveVideo } from '@/hooks/useSaveVideo'

export function AddVideoWatermarkView() {
  const video = useAddVideoWatermarkStore((s) => s.video)
  const config = useAddVideoWatermarkStore((s) => s.config)
  const exportFormat = useAddVideoWatermarkStore((s) => s.exportFormat)
  const exporting = useAddVideoWatermarkStore((s) => s.exporting)
  const exportProgress = useAddVideoWatermarkStore((s) => s.exportProgress)
  const setVideo = useAddVideoWatermarkStore((s) => s.setVideo)
  const setExporting = useAddVideoWatermarkStore((s) => s.setExporting)
  const setExportProgress = useAddVideoWatermarkStore((s) => s.setExportProgress)
  const showToast = useAppStore((s) => s.showToast)
  const { saveVideo } = useSaveVideo()

  const handleExport = async () => {
    if (!video) {
      showToast('请先上传视频')
      return
    }
    if (!config.text.enabled && !config.logo.enabled) {
      showToast('请至少启用一种水印')
      return
    }

    setExporting(true)
    setExportProgress(0)
    try {
      const { blob, format, hasAudio } = await exportWatermarkedVideo(
        video.url,
        video.width,
        video.height,
        video.fps ?? DEFAULT_VIDEO_FPS,
        config,
        exportFormat,
        (p) => setExportProgress(Math.round(p.progress)),
      )
      const baseName = video.file.name.replace(/\.[^.]+$/, '')
      await saveVideo(blob, baseName, format)
      if (exportFormat === 'mp4' && !hasAudio) {
        showToast('MP4 已导出（当前浏览器未保留音轨，需要音轨请选 WebM）')
      }
    } catch {
      showToast('视频导出失败，请重试')
    } finally {
      setExporting(false)
      setExportProgress(0)
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr_280px] gap-4">
        <aside className="min-h-0 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white p-4">
          <VideoUpload video={video} onVideo={setVideo} label="上传原视频" />
        </aside>

        <main className="min-h-0 min-w-0 overflow-y-auto">
          <VideoWatermarkPreview />
        </main>

        <aside className="min-h-0 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white p-4">
          <WatermarkControls variant="video" />
        </aside>
      </div>

      <div className="flex flex-col items-center gap-2 pb-2">
        {exporting && (
          <div className="w-full max-w-md">
            <div className="mb-1 flex justify-between text-xs text-[var(--color-muted)]">
              <span>正在导出视频…</span>
              <span>{exportProgress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-teal-brand transition-all"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={handleExport}
          disabled={!video || exporting}
          className="rounded-xl bg-teal-brand px-8 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-teal-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {exporting ? '导出中…' : '保存视频'}
        </button>
      </div>
    </div>
  )
}
