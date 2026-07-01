import { create } from 'zustand'
import {
  DEFAULT_WATERMARK_CONFIG,
  type ExportFormat,
  type ImageFile,
  type WatermarkConfig,
} from '@/types'

interface AddWatermarkState {
  image: ImageFile | null
  config: WatermarkConfig
  exportFormat: ExportFormat
  jpegQuality: number
  setImage: (image: ImageFile | null) => void
  setConfig: (updater: (prev: WatermarkConfig) => WatermarkConfig) => void
  resetConfig: () => void
  setExportFormat: (format: ExportFormat) => void
  setJpegQuality: (quality: number) => void
}

export const useAddWatermarkStore = create<AddWatermarkState>((set) => ({
  image: null,
  config: DEFAULT_WATERMARK_CONFIG,
  exportFormat: 'png',
  jpegQuality: 90,
  setImage: (image) => set({ image }),
  setConfig: (updater) => set((s) => ({ config: updater(s.config) })),
  resetConfig: () => set({ config: DEFAULT_WATERMARK_CONFIG }),
  setExportFormat: (format) => set({ exportFormat: format }),
  setJpegQuality: (quality) => set({ jpegQuality: quality }),
}))
