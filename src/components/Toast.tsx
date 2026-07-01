import { useAppStore } from '@/stores/appStore'

export function Toast() {
  const toast = useAppStore((s) => s.toast)
  if (!toast) return null

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-[fadeIn_0.2s_ease]">
      <div className="rounded-xl bg-slate-900 px-5 py-3 text-sm text-white shadow-lg">
        {toast}
      </div>
    </div>
  )
}
