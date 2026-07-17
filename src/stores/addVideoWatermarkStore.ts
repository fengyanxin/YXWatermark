import { create } from 'zustand'
import {
  DEFAULT_WATERMARK_CONFIG,
  type VideoExportFormat,
  type VideoFile,
  type WatermarkConfig,
} from '@/types'

interface AddVideoWatermarkState {
  video: VideoFile | null
  config: WatermarkConfig
  exportFormat: VideoExportFormat
  exporting: boolean
  exportProgress: number
  setVideo: (video: VideoFile | null) => void
  setConfig: (updater: (prev: WatermarkConfig) => WatermarkConfig) => void
  resetConfig: () => void
  setExportFormat: (format: VideoExportFormat) => void
  setExporting: (exporting: boolean) => void
  setExportProgress: (progress: number) => void
}

export const useAddVideoWatermarkStore = create<AddVideoWatermarkState>((set) => ({
  video: null,
  config: DEFAULT_WATERMARK_CONFIG,
  exportFormat: 'webm',
  exporting: false,
  exportProgress: 0,
  setVideo: (video) => set({ video }),
  setConfig: (updater) => set((s) => ({ config: updater(s.config) })),
  resetConfig: () => set({ config: DEFAULT_WATERMARK_CONFIG }),
  setExportFormat: (exportFormat) => set({ exportFormat }),
  setExporting: (exporting) => set({ exporting }),
  setExportProgress: (exportProgress) => set({ exportProgress }),
}))
