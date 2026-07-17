import { useCallback, useState } from 'react'
import { VideoUpload } from '@/components/VideoUpload'
import { VideoMaskEditor, type MaskData } from '@/features/remove-video-watermark/VideoMaskEditor'
import { RemoveVideoControls } from '@/features/remove-video-watermark/RemoveVideoControls'
import { useRemoveVideoWatermarkStore } from '@/stores/removeVideoWatermarkStore'

const emptyMask: MaskData = { lines: [], rects: [] }

export function RemoveVideoWatermarkView() {
  const video = useRemoveVideoWatermarkStore((s) => s.video)
  const setVideo = useRemoveVideoWatermarkStore((s) => s.setVideo)
  const [maskData, setMaskData] = useState<MaskData>(emptyMask)

  const handleMaskChange = useCallback((mask: MaskData) => {
    setMaskData(mask)
  }, [])

  const handleVideoChange = useCallback(
    (v: Parameters<typeof setVideo>[0]) => {
      setVideo(v)
      setMaskData(emptyMask)
    },
    [setVideo],
  )

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr_280px] gap-4">
        <aside className="min-h-0 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white p-4">
          <VideoUpload video={video} onVideo={handleVideoChange} label="上传待处理视频" />
        </aside>

        <main className="min-h-0 min-w-0 overflow-y-auto">
          <VideoMaskEditor onMaskChange={handleMaskChange} />
        </main>

        <aside className="min-h-0 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white p-4">
          <RemoveVideoControls maskData={maskData} />
        </aside>
      </div>
    </div>
  )
}
