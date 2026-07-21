import { useCallback, useState } from 'react'
import { useRemoveVideoWatermarkStore } from '@/stores/removeVideoWatermarkStore'
import { useAppStore } from '@/stores/appStore'
import { useSettingsStore } from '@/stores/appStore'
import { PanelSection, SliderField } from '@/components/PanelSection'
import type { MaskData } from '@/features/remove-video-watermark/VideoMaskEditor'
import { maskLayerToDataUrl, prepareMaskForInpaint } from '@/lib/canvas/maskUtils'
import {
  compositeInpaintResult,
  ensurePngBlob,
  estimateMaskCoverage,
} from '@/lib/canvas/compositeInpaint'
import { createAIServiceClient } from '@/lib/ai-service/client'
import { inpaintWithOpenCV } from '@/lib/opencv/inpaint'
import { imageUrlToBlob } from '@/lib/utils/image'
import { removeWatermarkFromVideo, computeRemoveVideoPercent, formatRemoveVideoProgress } from '@/lib/video/removeWatermarkVideo'
import { formatVideoFps, computeProcessFrameCount } from '@/lib/utils/video'
import { useSaveVideo } from '@/hooks/useSaveVideo'
import { DEFAULT_VIDEO_FPS, MAX_VIDEO_DURATION } from '@/types'

export function RemoveVideoControls({ maskData }: { maskData: MaskData }) {
  const mode = useRemoveVideoWatermarkStore((s) => s.mode)
  const setMode = useRemoveVideoWatermarkStore((s) => s.setMode)
  const maskTool = useRemoveVideoWatermarkStore((s) => s.maskTool)
  const setMaskTool = useRemoveVideoWatermarkStore((s) => s.setMaskTool)
  const brushSize = useRemoveVideoWatermarkStore((s) => s.brushSize)
  const setBrushSize = useRemoveVideoWatermarkStore((s) => s.setBrushSize)
  const processing = useRemoveVideoWatermarkStore((s) => s.processing)
  const setProcessing = useRemoveVideoWatermarkStore((s) => s.setProcessing)
  const previewing = useRemoveVideoWatermarkStore((s) => s.previewing)
  const setPreviewing = useRemoveVideoWatermarkStore((s) => s.setPreviewing)
  const processProgress = useRemoveVideoWatermarkStore((s) => s.processProgress)
  const setProcessProgress = useRemoveVideoWatermarkStore((s) => s.setProcessProgress)
  const video = useRemoveVideoWatermarkStore((s) => s.video)
  const previewFrameUrl = useRemoveVideoWatermarkStore((s) => s.previewFrameUrl)
  const frameResultUrl = useRemoveVideoWatermarkStore((s) => s.frameResultUrl)
  const setFrameResultUrl = useRemoveVideoWatermarkStore((s) => s.setFrameResultUrl)
  const resultVideoUrl = useRemoveVideoWatermarkStore((s) => s.resultVideoUrl)
  const setResultVideoUrl = useRemoveVideoWatermarkStore((s) => s.setResultVideoUrl)
  const setPreviewMode = useRemoveVideoWatermarkStore((s) => s.setPreviewMode)
  const setLastEngine = useRemoveVideoWatermarkStore((s) => s.setLastEngine)
  const lastEngine = useRemoveVideoWatermarkStore((s) => s.lastEngine)
  const comparePosition = useRemoveVideoWatermarkStore((s) => s.comparePosition)
  const setComparePosition = useRemoveVideoWatermarkStore((s) => s.setComparePosition)
  const aiOnline = useAppStore((s) => s.aiOnline)
  const showToast = useAppStore((s) => s.showToast)
  const aiServiceUrl = useSettingsStore((s) => s.aiServiceUrl)
  const { saveVideo } = useSaveVideo()
  const [exportDetail, setExportDetail] = useState('')

  const exportFps = video?.fps ?? DEFAULT_VIDEO_FPS
  const frameCount = video
    ? (video.frameCount ?? computeProcessFrameCount(video.duration, exportFps))
    : 0
  const hasMask =
    maskData.lines.length > 0 ||
    maskData.rects.some((r) => r.width > 0 && r.height > 0)

  const buildMaskUrl = useCallback(async () => {
    if (!video) throw new Error('无视频')
    const rawMask = maskLayerToDataUrl(
      maskData.lines,
      maskData.rects,
      video.width,
      video.height,
    )
    return prepareMaskForInpaint(rawMask, video.width, video.height, {
      sourceImageUrl: previewFrameUrl ?? undefined,
      rects: maskData.rects.filter((r) => r.width > 0 && r.height > 0),
    })
  }, [video, maskData, previewFrameUrl])

  const processFrameWithAI = useCallback(
    async (maskUrl: string) => {
      if (!video || !previewFrameUrl) return
      const client = createAIServiceClient(aiServiceUrl)
      const imageBlob = await ensurePngBlob(
        await imageUrlToBlob(previewFrameUrl),
        video.width,
        video.height,
      )
      const maskBlob = await ensurePngBlob(
        await imageUrlToBlob(maskUrl),
        video.width,
        video.height,
      )
      const resultBlob = await client.inpaint(imageBlob, maskBlob, {
        width: video.width,
        height: video.height,
        textWatermark: true,
      })
      return compositeInpaintResult(
        previewFrameUrl,
        resultBlob,
        maskUrl,
        video.width,
        video.height,
      )
    },
    [video, previewFrameUrl, aiServiceUrl],
  )

  const processFrameWithOpenCV = useCallback(
    async (maskUrl: string) => {
      if (!video || !previewFrameUrl) return
      return inpaintWithOpenCV(previewFrameUrl, maskUrl, video.width, video.height)
    },
    [video, previewFrameUrl],
  )

  const resolveEngine = async (): Promise<'ai' | 'opencv' | null> => {
    if (mode === 'simple') return 'opencv'
    if (!aiOnline) return null
    const client = createAIServiceClient(aiServiceUrl)
    const stillOnline = await client.checkHealth()
    return stillOnline ? 'ai' : null
  }

  const handlePreviewFrame = async () => {
    if (!video || !previewFrameUrl) {
      showToast('请先上传视频并等待参考帧加载')
      return
    }
    if (!hasMask) {
      showToast('请先在当前帧上标记水印区域')
      return
    }

    setPreviewing(true)
    setFrameResultUrl(null)
    try {
      const maskUrl = await buildMaskUrl()
      const coverage = await estimateMaskCoverage(maskUrl, video.width, video.height)
      if (coverage > 0.06) {
        showToast(`选区占画面 ${(coverage * 100).toFixed(1)}%，过大易模糊，建议仅框住文字`)
      }

      const engine = await resolveEngine()
      if (!engine) {
        showToast('AI 离线：请运行 docker compose up -d，或切换「简单修复」')
        return
      }

      const result =
        engine === 'ai'
          ? await processFrameWithAI(maskUrl)
          : await processFrameWithOpenCV(maskUrl)

      if (result) {
        setFrameResultUrl(result)
        setLastEngine(engine)
        setPreviewMode('mark')
        showToast(
          engine === 'ai'
            ? '当前帧 AI 预览完成，拖动对比线查看效果'
            : '当前帧简单修复预览完成',
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '预览失败'
      showToast(msg)
    } finally {
      setPreviewing(false)
    }
  }

  const handleExportVideo = async () => {
    if (!video || !previewFrameUrl) {
      showToast('请先上传视频并等待参考帧加载')
      return
    }
    if (!hasMask) {
      showToast('请先在当前帧上标记水印区域')
      return
    }

    setProcessing(true)
    setProcessProgress(1)
    setExportDetail('准备导出…')

    try {
      const maskUrl = await buildMaskUrl()
      const coverage = await estimateMaskCoverage(maskUrl, video.width, video.height)
      if (coverage > 0.06) {
        showToast(`选区占画面 ${(coverage * 100).toFixed(1)}%，过大易模糊，建议仅框住文字`)
      }

      const engine = await resolveEngine()
      if (!engine) {
        showToast('AI 离线：请运行 docker compose up -d，或切换「简单修复」')
        return
      }

      showToast(`开始逐帧修复，共 ${frameCount} 帧（${formatVideoFps(exportFps)} fps），请耐心等待…`)

      const { blob, format, fallbackReason } = await removeWatermarkFromVideo({
        videoUrl: video.url,
        width: video.width,
        height: video.height,
        duration: video.duration,
        maskUrl,
        aiServiceUrl,
        useAi: engine === 'ai',
        format: 'mp4',
        fps: exportFps,
        frameCount: video.frameCount ?? computeProcessFrameCount(video.duration, exportFps),
        onProgress: (p) => {
          setProcessProgress(computeRemoveVideoPercent(p))
          setExportDetail(formatRemoveVideoProgress(p))
        },
      })

      if (resultVideoUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(resultVideoUrl)
      }
      const resultObjectUrl = URL.createObjectURL(blob)
      setResultVideoUrl(resultObjectUrl)
      setPreviewMode('video-result')
      setLastEngine(engine)

      const baseName = video.file.name.replace(/\.[^.]+$/, '')
      try {
        await saveVideo(blob, baseName, format, 'removed')
      } catch {
        showToast('视频已生成，自动保存失败，可在「视频效果对比」中播放后另存')
      }
      showToast(
        engine === 'ai'
          ? `AI 修复完成（${frameCount} 帧 · ${format.toUpperCase()}），可切换「视频效果对比」预览`
          : `简单修复完成（${frameCount} 帧 · ${format.toUpperCase()}）`,
      )
      if (format !== 'mp4') {
        showToast(`编码已回退为 ${format.toUpperCase()}（${fallbackReason ?? 'WebCodecs 不可用'}），时长仍与原片一致`)
      } else if (fallbackReason) {
        showToast(`MP4 已通过备用编码器导出（WebCodecs：${fallbackReason}）`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '处理失败'
      showToast(msg)
    } finally {
      setProcessing(false)
      setExportDetail('')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PanelSection title="处理模式">
        <div className="space-y-2">
          {(
            [
              { id: 'manual' as const, label: '手动标记', desc: '矩形框选固定位置水印，逐帧 AI 修复' },
              { id: 'simple' as const, label: '简单修复', desc: '无 AI 时可用，逐帧 OpenCV，易模糊' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`w-full rounded-lg border p-3 text-left transition-all ${
                mode === m.id
                  ? 'border-teal-brand bg-teal-brand/5'
                  : 'border-[var(--color-border)] hover:border-teal-brand/40'
              }`}
            >
              <p className="text-sm font-medium">{m.label}</p>
              <p className="text-xs text-[var(--color-muted)]">{m.desc}</p>
            </button>
          ))}
        </div>
      </PanelSection>

      <div className="rounded-lg border border-teal-brand/20 bg-teal-50 p-3 text-xs text-teal-900">
        <p className="font-medium mb-1">预览流程</p>
        <ol className="list-decimal pl-4 space-y-0.5">
          <li>播放原视频，定位有水印的帧</li>
          <li>框选水印 → <strong>预览当前帧</strong> 查看效果</li>
          <li>满意后 → <strong>导出修复视频</strong></li>
        </ol>
      </div>

      {video && (
        <PanelSection title="导出格式">
          <p className="text-sm text-[var(--color-text)]">MP4</p>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            先完成全部帧 AI 修复，再 WebCodecs 编码为 MP4；不支持时尝试 MediaRecorder MP4。
          </p>
        </PanelSection>
      )}

      {video && (
        <p className="text-xs text-[var(--color-muted)]">
          预计导出 {frameCount} 帧（{video.duration.toFixed(1)}s · 原片 {formatVideoFps(exportFps)} fps，最长{' '}
          {MAX_VIDEO_DURATION}s）
        </p>
      )}

      {lastEngine === 'ai' && (frameResultUrl || resultVideoUrl) && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">
          ✓ 已使用 AI (LaMa) 修复
        </div>
      )}

      {mode === 'manual' && (
        <div className="rounded-lg border border-teal-brand/20 bg-teal-50 p-3 text-xs text-teal-900">
          <p className="font-medium mb-1">矩形标记技巧</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>框住水印即可；检测不到时会<strong>自动内缩矩形</strong>确保去除</li>
            <li>仍未去掉时，换<strong>画笔</strong>直接涂在水印上</li>
          </ul>
        </div>
      )}

      {mode === 'manual' && (
        <PanelSection title="标记工具">
          <div className="flex gap-2">
            {(
              [
                { id: 'brush' as const, label: '🖌 画笔' },
                { id: 'rect' as const, label: '⬜ 矩形' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setMaskTool(t.id)}
                className={`flex-1 rounded-lg border py-2 text-sm ${
                  maskTool === t.id
                    ? 'border-teal-brand bg-teal-brand/10 text-teal-brand'
                    : 'border-[var(--color-border)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {maskTool === 'brush' && (
            <SliderField
              label="画笔大小"
              value={brushSize}
              min={8}
              max={80}
              onChange={setBrushSize}
            />
          )}
        </PanelSection>
      )}

      {mode === 'manual' && !aiOnline && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          AI 服务离线。视频去水印建议使用 AI 模式，请运行{' '}
          <code className="bg-red-100 px-1 rounded">docker compose up -d</code>
        </div>
      )}

      {frameResultUrl && (
        <PanelSection title="帧对比">
          <SliderField
            label="对比位置"
            value={comparePosition}
            min={0}
            max={100}
            unit="%"
            onChange={setComparePosition}
          />
        </PanelSection>
      )}

      {(processing || previewing) && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-[var(--color-muted)]">
            <span className="truncate pr-2">
              {previewing ? '预览中…' : exportDetail || '导出中…'}
            </span>
            {!previewing && <span className="shrink-0">{processProgress}%</span>}
          </div>
          {!previewing && (
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-teal-brand transition-all"
                style={{ width: `${processProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className="mt-auto space-y-2">
        <button
          type="button"
          onClick={handlePreviewFrame}
          disabled={previewing || processing || !video}
          className="w-full rounded-xl border border-teal-brand py-2.5 text-sm font-medium text-teal-brand hover:bg-teal-brand/5 disabled:opacity-50"
        >
          {previewing ? '预览中…' : '预览当前帧'}
        </button>
        {frameResultUrl && (
          <button
            type="button"
            onClick={() => setFrameResultUrl(null)}
            className="w-full rounded-xl border border-[var(--color-border)] py-2 text-sm text-[var(--color-muted)] hover:bg-slate-50"
          >
            清除帧预览，重新标记
          </button>
        )}
        <button
          type="button"
          onClick={handleExportVideo}
          disabled={processing || previewing || !video}
          className="w-full rounded-xl bg-teal-brand py-3 text-sm font-semibold text-white hover:bg-teal-brand-dark disabled:opacity-50"
        >
          {processing ? '导出中…' : '导出修复视频'}
        </button>
      </div>
    </div>
  )
}
