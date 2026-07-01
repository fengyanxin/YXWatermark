import { create } from 'zustand'
import type { ImageFile, MaskTool, RemoveMode } from '@/types'

interface RemoveWatermarkState {
  image: ImageFile | null
  resultUrl: string | null
  mode: RemoveMode
  maskTool: MaskTool
  brushSize: number
  processing: boolean
  comparePosition: number
  lastEngine: 'ai' | 'opencv' | null
  setImage: (image: ImageFile | null) => void
  setResultUrl: (url: string | null) => void
  setLastEngine: (engine: 'ai' | 'opencv' | null) => void
  setMode: (mode: RemoveMode) => void
  setMaskTool: (tool: MaskTool) => void
  setBrushSize: (size: number) => void
  setProcessing: (processing: boolean) => void
  setComparePosition: (pos: number) => void
  reset: () => void
}

export const useRemoveWatermarkStore = create<RemoveWatermarkState>((set) => ({
  image: null,
  resultUrl: null,
  mode: 'manual',
  maskTool: 'brush',
  brushSize: 24,
  processing: false,
  comparePosition: 50,
  lastEngine: null as 'ai' | 'opencv' | null,
  setImage: (image) => set({ image, resultUrl: null, comparePosition: 50, lastEngine: null }),
  setResultUrl: (url) => set({ resultUrl: url }),
  setLastEngine: (engine) => set({ lastEngine: engine }),
  setMode: (mode) => set({ mode }),
  setMaskTool: (tool) => set({ maskTool: tool }),
  setBrushSize: (size) => set({ brushSize: size }),
  setProcessing: (processing) => set({ processing }),
  setComparePosition: (pos) => set({ comparePosition: pos }),
  reset: () =>
    set({
      image: null,
      resultUrl: null,
      processing: false,
      comparePosition: 50,
    }),
}))
