import { useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'
import { saveDataUrlOnDownload } from '@/lib/utils/saveFile'

export function useSaveImage() {
  const showToast = useAppStore((s) => s.showToast)

  const saveImage = useCallback(
    async (dataUrl: string, filename: string) => {
      const result = await saveDataUrlOnDownload(dataUrl, filename)

      if (result.cancelled) return

      switch (result.method) {
        case 'folder':
          showToast(`已保存到「${result.folderName}」/${filename}`)
          break
        case 'picker':
          showToast('图片已保存')
          break
        case 'browser':
          showToast('图片已下载')
          break
      }
    },
    [showToast],
  )

  return { saveImage }
}
