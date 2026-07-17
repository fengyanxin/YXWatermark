import { useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'
import { saveBlobOnDownload } from '@/lib/utils/saveFile'
import { videoExtensionForFormat } from '@/lib/video/frameEncoder'
import type { VideoExportFormat } from '@/types'

export function useSaveVideo() {
  const showToast = useAppStore((s) => s.showToast)

  const saveVideo = useCallback(
    async (blob: Blob, baseName: string, format: VideoExportFormat, suffix = 'watermarked') => {
      const ext = videoExtensionForFormat(format)
      const filename = `${baseName}-${suffix}.${ext}`
      const result = await saveBlobOnDownload(blob, filename)

      if (result.cancelled) return

      switch (result.method) {
        case 'folder':
          showToast(`已保存到「${result.folderName}」/${filename}`)
          break
        case 'picker':
          showToast('视频已保存')
          break
        case 'browser':
          showToast('视频已下载')
          break
      }
    },
    [showToast],
  )

  return { saveVideo }
}
