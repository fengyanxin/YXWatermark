import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useSettingsStore } from '@/stores/appStore'
import { createAIServiceClient } from '@/lib/ai-service/client'

export function SettingsModal() {
  const open = useAppStore((s) => s.settingsOpen)
  const setOpen = useAppStore((s) => s.setSettingsOpen)
  const showToast = useAppStore((s) => s.showToast)
  const setAiOnline = useAppStore((s) => s.setAiOnline)
  const aiServiceUrl = useSettingsStore((s) => s.aiServiceUrl)
  const setAiServiceUrl = useSettingsStore((s) => s.setAiServiceUrl)
  const [draftUrl, setDraftUrl] = useState(aiServiceUrl)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (open) setDraftUrl(aiServiceUrl)
  }, [open, aiServiceUrl])

  if (!open) return null

  const testConnection = async () => {
    setTesting(true)
    const client = createAIServiceClient(draftUrl)
    const ok = await client.checkHealth()
    setAiOnline(ok)
    showToast(ok ? 'AI 服务连接成功' : 'AI 服务连接失败')
    setTesting(false)
  }

  const save = () => {
    setAiServiceUrl(draftUrl)
    setOpen(false)
    showToast('设置已保存')
    createAIServiceClient(draftUrl)
      .checkHealth()
      .then(setAiOnline)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">设置</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg px-2 py-1 text-[var(--color-muted)] hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">AI 服务地址</span>
            <input
              type="text"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              placeholder="/lama-api"
              className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-teal-brand focus:ring-2 focus:ring-teal-brand/20"
            />
            <p className="text-xs text-[var(--color-muted)]">
              Docker 部署默认 <code className="bg-slate-100 px-1 rounded">/lama-api</code>，由 Nginx 转发至 AI 服务，无需修改
            </p>
          </label>

          <div className="rounded-lg bg-slate-50 p-4 text-sm text-[var(--color-muted)]">
            <p className="mb-2 font-medium text-[var(--color-text)]">Docker 一键部署</p>
            <code className="block rounded bg-slate-900 px-3 py-2 text-xs text-green-400">
              docker compose up -d --build
            </code>
            <p className="mt-2 text-xs">
              访问 http://localhost:3000，AI 服务由容器自动启动，无需单独配置。
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={testConnection}
              disabled={testing}
              className="flex-1 rounded-lg border border-[var(--color-border)] py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              {testing ? '检测中…' : '检测连接'}
            </button>
            <button
              type="button"
              onClick={save}
              className="flex-1 rounded-lg bg-teal-brand py-2 text-sm font-medium text-white hover:bg-teal-brand-dark"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
