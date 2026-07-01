import { useCallback, useRef } from 'react'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE, type ImageFile } from '@/types'
import { getImageDimensions } from '@/lib/utils/image'
import { useAppStore } from '@/stores/appStore'

interface ImageUploadProps {
  image: ImageFile | null
  onImage: (image: ImageFile | null) => void
  label?: string
}

export function ImageUpload({ image, onImage, label = '上传图片' }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const showToast = useAppStore((s) => s.showToast)

  const handleFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        showToast('请上传 JPG / PNG / WebP 格式图片')
        return
      }
      if (file.size > MAX_IMAGE_SIZE) {
        showToast('图片不能超过 20MB，请压缩后重试')
        return
      }
      try {
        const { width, height, url } = await getImageDimensions(file)
        onImage({ file, url, width, height })
      } catch {
        showToast('图片加载失败，请重试')
      }
    },
    [onImage, showToast],
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
          📷
        </div>
        <p className="text-sm font-medium text-[var(--color-text)]">{label}</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">拖拽或点击选择 · JPG PNG WebP</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          className="hidden"
          onChange={onChange}
        />
      </div>

      {image && (
        <div className="rounded-lg border border-[var(--color-border)] bg-white p-3">
          <div className="flex items-center gap-3">
            <img
              src={image.url}
              alt="预览"
              className="h-14 w-14 rounded object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{image.file.name}</p>
              <p className="text-xs text-[var(--color-muted)]">
                {image.width} × {image.height}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onImage(null)}
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
