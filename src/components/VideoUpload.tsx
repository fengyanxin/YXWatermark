import { useCallback, useRef } from 'react'
import {
  ACCEPTED_VIDEO_TYPES,
  MAX_VIDEO_DURATION,
  MAX_VIDEO_SIZE,
  type VideoFile,
} from '@/types'
import { getVideoMeta } from '@/lib/utils/video'
import { useAppStore } from '@/stores/appStore'

const MAX_VIDEO_SIZE_MB = MAX_VIDEO_SIZE / (1024 * 1024)

interface VideoUploadProps {
  video: VideoFile | null
  onVideo: (video: VideoFile | null) => void
  label?: string
}

export function VideoUpload({ video, onVideo, label = '上传视频' }: VideoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const showToast = useAppStore((s) => s.showToast)

  const handleFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
        showToast('请上传 MP4 / WebM / MOV 格式视频')
        return
      }
      if (file.size > MAX_VIDEO_SIZE) {
        showToast(`视频不能超过 ${MAX_VIDEO_SIZE_MB}MB，请压缩后重试`)
        return
      }
      try {
        const { width, height, duration, url, fps, frameCount, firstFrameUrl } = await getVideoMeta(file)
        if (duration > MAX_VIDEO_DURATION) {
          URL.revokeObjectURL(url)
          showToast(`视频时长不能超过 ${MAX_VIDEO_DURATION} 秒`)
          return
        }
        onVideo({ file, url, width, height, duration, fps, frameCount, firstFrameUrl })
      } catch {
        showToast('视频加载失败，请重试')
      }
    },
    [onVideo, showToast],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      e.target.value = ''
    },
    [handleFile],
  )

  const formatDuration = (seconds: number) => {
    const s = Math.floor(seconds % 60)
    const m = Math.floor(seconds / 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--color-border)] bg-white p-6 transition-colors hover:border-teal-brand hover:bg-teal-50/30"
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-brand/10 text-2xl">
          🎬
        </div>
        <p className="text-sm font-medium text-[var(--color-text)]">{label}</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          拖拽或点击选择 · MP4 WebM MOV · 最大 {MAX_VIDEO_SIZE_MB}MB · 最长 {MAX_VIDEO_DURATION}s
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_VIDEO_TYPES.join(',')}
          className="hidden"
          onChange={onChange}
        />
      </div>

      {video && (
        <div className="rounded-lg border border-[var(--color-border)] bg-white p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded bg-slate-100 text-xl">
              🎥
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{video.file.name}</p>
              <p className="text-xs text-[var(--color-muted)]">
                {video.width} × {video.height} · {video.fps} fps · {formatDuration(video.duration)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onVideo(null)}
              className="rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50"
            >
              移除
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
