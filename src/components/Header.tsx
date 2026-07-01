import { useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useSettingsStore } from '@/stores/appStore'
import { createAIServiceClient } from '@/lib/ai-service/client'

export function Header() {
  const activeTab = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen)
  const aiOnline = useAppStore((s) => s.aiOnline)
  const setAiOnline = useAppStore((s) => s.setAiOnline)
  const aiServiceUrl = useSettingsStore((s) => s.aiServiceUrl)

  useEffect(() => {
    const check = () => {
      createAIServiceClient(aiServiceUrl)
        .checkHealth()
        .then(setAiOnline)
        .catch(() => setAiOnline(false))
    }
    check()
    const interval = setInterval(check, 15000)
    return () => clearInterval(interval)
  }, [aiServiceUrl, setAiOnline])

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-white px-6 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-brand text-white font-bold text-sm">
          YX
        </div>
        <div>
          <h1 className="text-base font-semibold leading-tight">YXWatermark</h1>
          <p className="text-xs text-[var(--color-muted)]">本地图片水印工具</p>
        </div>
      </div>

      <nav className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
        {(
          [
            { id: 'add' as const, label: '添加水印' },
            { id: 'remove' as const, label: '去除水印' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-teal-brand shadow-sm'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs"
          title={aiOnline ? 'AI 服务在线' : aiOnline === false ? 'AI 服务离线' : '检测中'}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              aiOnline === true
                ? 'bg-green-500'
                : aiOnline === false
                  ? 'bg-red-400'
                  : 'bg-amber-400 animate-pulse'
            }`}
          />
          <span className="text-[var(--color-muted)]">
            {aiOnline === true ? 'AI 在线' : aiOnline === false ? 'AI 离线' : '检测中'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          ⚙ 设置
        </button>
      </div>
    </header>
  )
}
