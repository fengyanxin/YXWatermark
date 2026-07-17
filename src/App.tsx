import { Header } from '@/components/Header'
import { SettingsModal } from '@/components/SettingsModal'
import { Toast } from '@/components/Toast'
import { AddWatermarkView } from '@/features/add-watermark/AddWatermarkView'
import { AddVideoWatermarkView } from '@/features/add-video-watermark/AddVideoWatermarkView'
import { RemoveWatermarkView } from '@/features/remove-watermark/RemoveWatermarkView'
import { RemoveVideoWatermarkView } from '@/features/remove-video-watermark/RemoveVideoWatermarkView'
import { useAppStore } from '@/stores/appStore'

export default function App() {
  const activeTab = useAppStore((s) => s.activeTab)
  const mediaType = useAppStore((s) => s.mediaType)

  const View =
    mediaType === 'image'
      ? activeTab === 'add'
        ? AddWatermarkView
        : RemoveWatermarkView
      : activeTab === 'add'
        ? AddVideoWatermarkView
        : RemoveVideoWatermarkView

  return (
    <div className="flex h-full flex-col">
      <Header />
      <main className="min-h-0 flex-1 overflow-hidden p-4">
        <View />
      </main>
      <SettingsModal />
      <Toast />
    </div>
  )
}
