import { Header } from '@/components/Header'
import { SettingsModal } from '@/components/SettingsModal'
import { Toast } from '@/components/Toast'
import { AddWatermarkView } from '@/features/add-watermark/AddWatermarkView'
import { RemoveWatermarkView } from '@/features/remove-watermark/RemoveWatermarkView'
import { useAppStore } from '@/stores/appStore'

export default function App() {
  const activeTab = useAppStore((s) => s.activeTab)

  return (
    <div className="flex h-full flex-col">
      <Header />
      <main className="min-h-0 flex-1 overflow-hidden p-4">
        {activeTab === 'add' ? <AddWatermarkView /> : <RemoveWatermarkView />}
      </main>
      <SettingsModal />
      <Toast />
    </div>
  )
}
