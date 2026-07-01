import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  aiServiceUrl: string
  setAiServiceUrl: (url: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      aiServiceUrl: '/lama-api',
      setAiServiceUrl: (url) => set({ aiServiceUrl: normalizeAiServiceUrl(url) }),
    }),
    {
      name: 'yxwatermark-settings',
      merge: (persisted, current) => {
        const p = persisted as Partial<SettingsState> | undefined
        return {
          ...current,
          ...p,
          aiServiceUrl: normalizeAiServiceUrl(p?.aiServiceUrl ?? current.aiServiceUrl),
        }
      },
    },
  ),
)

/** 开发环境走 Vite 代理，避免跨域；兼容旧版 localhost 配置 */
function normalizeAiServiceUrl(url: string): string {
  if (url === 'http://localhost:8080' || url === 'http://127.0.0.1:8080') {
    return '/lama-api'
  }
  return url.replace(/\/$/, '')
}

interface AppState {
  activeTab: 'add' | 'remove'
  settingsOpen: boolean
  toast: string | null
  aiOnline: boolean | null
  setActiveTab: (tab: 'add' | 'remove') => void
  setSettingsOpen: (open: boolean) => void
  showToast: (message: string) => void
  clearToast: () => void
  setAiOnline: (online: boolean | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'add',
  settingsOpen: false,
  toast: null,
  aiOnline: null,
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  showToast: (message) => {
    set({ toast: message })
    setTimeout(() => set({ toast: null }), 3200)
  },
  clearToast: () => set({ toast: null }),
  setAiOnline: (online) => set({ aiOnline: online }),
}))
