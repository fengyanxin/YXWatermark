import { create } from 'zustand'
import type { MaskTool, RemoveMode, VideoExportFormat, VideoFile } from '@/types'

interface RemoveVideoWatermarkState {
  video: VideoFile | null
  previewFrameUrl: string | null
  previewTime: number
  /** 当前帧修复预览（图片） */
  frameResultUrl: string | null
  /** 完整修复后视频 */
  resultVideoUrl: string | null
  exportFormat: VideoExportFormat
  previewMode: 'mark' | 'video-result'
  mode: RemoveMode
  maskTool: MaskTool
  brushSize: number
  processing: boolean
  previewing: boolean
  processProgress: number
  comparePosition: number
  lastEngine: 'ai' | 'opencv' | null
  setVideo: (video: VideoFile | null) => void
  setPreviewFrameUrl: (url: string | null) => void
  setPreviewTime: (time: number) => void
  setFrameResultUrl: (url: string | null) => void
  setResultVideoUrl: (url: string | null) => void
  setExportFormat: (format: VideoExportFormat) => void
  setPreviewMode: (mode: 'mark' | 'video-result') => void
  setLastEngine: (engine: 'ai' | 'opencv' | null) => void
  setMode: (mode: RemoveMode) => void
  setMaskTool: (tool: MaskTool) => void
  setBrushSize: (size: number) => void
  setProcessing: (processing: boolean) => void
  setPreviewing: (previewing: boolean) => void
  setProcessProgress: (progress: number) => void
  setComparePosition: (pos: number) => void
  reset: () => void
}

export const useRemoveVideoWatermarkStore = create<RemoveVideoWatermarkState>((set) => ({
  video: null,
  previewFrameUrl: null,
  previewTime: 0,
  frameResultUrl: null,
  resultVideoUrl: null,
  exportFormat: 'mp4',
  previewMode: 'mark',
  mode: 'manual',
  maskTool: 'rect',
  brushSize: 24,
  processing: false,
  previewing: false,
  processProgress: 0,
  comparePosition: 50,
  lastEngine: null,
  setVideo: (video) =>
    set({
      video,
      previewFrameUrl: video?.firstFrameUrl ?? null,
      previewTime: 0,
      frameResultUrl: null,
      resultVideoUrl: null,
      exportFormat: 'mp4',
      previewMode: 'mark',
      comparePosition: 50,
      lastEngine: null,
      processProgress: 0,
    }),
  setPreviewFrameUrl: (url) => set({ previewFrameUrl: url }),
  setPreviewTime: (time) => set({ previewTime: time }),
  setFrameResultUrl: (url) => set({ frameResultUrl: url }),
  setResultVideoUrl: (url) => set({ resultVideoUrl: url }),
  setExportFormat: (format) => set({ exportFormat: format }),
  setPreviewMode: (mode) => set({ previewMode: mode }),
  setLastEngine: (engine) => set({ lastEngine: engine }),
  setMode: (mode) => set({ mode }),
  setMaskTool: (tool) => set({ maskTool: tool }),
  setBrushSize: (size) => set({ brushSize: size }),
  setProcessing: (processing) => set({ processing }),
  setPreviewing: (previewing) => set({ previewing }),
  setProcessProgress: (progress) => set({ processProgress: progress }),
  setComparePosition: (pos) => set({ comparePosition: pos }),
  reset: () =>
    set({
      video: null,
      previewFrameUrl: null,
      previewTime: 0,
      frameResultUrl: null,
      resultVideoUrl: null,
      exportFormat: 'mp4',
      previewMode: 'mark',
      processing: false,
      previewing: false,
      processProgress: 0,
      comparePosition: 50,
      lastEngine: null,
    }),
}))
