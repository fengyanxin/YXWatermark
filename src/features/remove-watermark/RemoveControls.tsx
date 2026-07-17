import { useCallback } from 'react'
import { useRemoveWatermarkStore } from '@/stores/removeWatermarkStore'
import { useAppStore } from '@/stores/appStore'
import { useSettingsStore } from '@/stores/appStore'
import { PanelSection, SliderField } from '@/components/PanelSection'
import type { MaskData } from '@/features/remove-watermark/MaskEditor'
import { detectWatermarkMask, maskLayerToDataUrl, prepareMaskForInpaint } from '@/lib/canvas/maskUtils'
import {
  compositeInpaintResult,
  ensurePngBlob,
  estimateMaskCoverage,
} from '@/lib/canvas/compositeInpaint'
import { createAIServiceClient } from '@/lib/ai-service/client'
import { inpaintWithOpenCV } from '@/lib/opencv/inpaint'
import { imageUrlToBlob } from '@/lib/utils/image'
import { useSaveImage } from '@/hooks/useSaveImage'

export function RemoveControls({ maskData }: { maskData: MaskData }) {
  const mode = useRemoveWatermarkStore((s) => s.mode)
  const setMode = useRemoveWatermarkStore((s) => s.setMode)
  const maskTool = useRemoveWatermarkStore((s) => s.maskTool)
  const setMaskTool = useRemoveWatermarkStore((s) => s.setMaskTool)
  const brushSize = useRemoveWatermarkStore((s) => s.brushSize)
  const setBrushSize = useRemoveWatermarkStore((s) => s.setBrushSize)
  const processing = useRemoveWatermarkStore((s) => s.processing)
  const setProcessing = useRemoveWatermarkStore((s) => s.setProcessing)
  const image = useRemoveWatermarkStore((s) => s.image)
  const resultUrl = useRemoveWatermarkStore((s) => s.resultUrl)
  const setResultUrl = useRemoveWatermarkStore((s) => s.setResultUrl)
  const setLastEngine = useRemoveWatermarkStore((s) => s.setLastEngine)
  const lastEngine = useRemoveWatermarkStore((s) => s.lastEngine)
  const comparePosition = useRemoveWatermarkStore((s) => s.comparePosition)
  const setComparePosition = useRemoveWatermarkStore((s) => s.setComparePosition)
  const aiOnline = useAppStore((s) => s.aiOnline)
  const showToast = useAppStore((s) => s.showToast)
  const aiServiceUrl = useSettingsStore((s) => s.aiServiceUrl)
  const { saveImage } = useSaveImage()

  const modes = [
    { id: 'manual' as const, label: '手动标记', desc: '推荐：矩形框选文字水印，效果最佳' },
    { id: 'auto' as const, label: '自动识别', desc: '实验性，自动检测边缘水印' },
    { id: 'simple' as const, label: '简单修复', desc: '无 AI 时可用，易模糊' },
  ]

  const hasMask =
    maskData.lines.length > 0 ||
    maskData.rects.some((r) => r.width > 0 && r.height > 0)

  const processWithAI = useCallback(
    async (maskUrl: string) => {
      if (!image) return
      const client = createAIServiceClient(aiServiceUrl)
      const imageBlob = await ensurePngBlob(
        await imageUrlToBlob(image.url),
        image.width,
        image.height,
      )
      const maskBlob = await ensurePngBlob(
        await imageUrlToBlob(maskUrl),
        image.width,
        image.height,
      )
      const resultBlob = await client.inpaint(imageBlob, maskBlob, {
        width: image.width,
        height: image.height,
        textWatermark: true,
      })
      // 只替换 mask 区域像素，防止 Crop 整块发糊
      return compositeInpaintResult(
        image.url,
        resultBlob,
        maskUrl,
        image.width,
        image.height,
      )
    },
    [image, aiServiceUrl],
  )

  const processWithOpenCV = useCallback(
    async (maskUrl: string) => {
      if (!image) return
      return inpaintWithOpenCV(image.url, maskUrl, image.width, image.height)
    },
    [image],
  )

  const handleProcess = async () => {
    if (!image) {
      showToast('请先上传图片')
      return
    }

    setProcessing(true)
    try {
      let maskUrl: string

      if (mode === 'auto') {
        maskUrl = await detectWatermarkMask(image.url, image.width, image.height)
      } else {
        if (!hasMask) {
          showToast('请先标记水印区域')
          setProcessing(false)
          return
        }
        const rawMask = maskLayerToDataUrl(
          maskData.lines,
          maskData.rects,
          image.width,
          image.height,
        )
        maskUrl = await prepareMaskForInpaint(rawMask, image.width, image.height, {
          sourceImageUrl: image.url,
          rects: maskData.rects.filter((r) => r.width > 0 && r.height > 0),
        })
      }

      const coverage = await estimateMaskCoverage(maskUrl, image.width, image.height)
      if (coverage > 0.06) {
        showToast(`选区占图片 ${(coverage * 100).toFixed(1)}%，过大易模糊，建议仅框住文字`)
      }

      let result: string | undefined
      let engineUsed: 'ai' | 'opencv' = 'opencv'

      if (mode === 'simple') {
        showToast('正在加载 OpenCV…')
        result = await processWithOpenCV(maskUrl)
        engineUsed = 'opencv'
      } else if (aiOnline) {
        // 处理前再次确认 AI 可用，避免误降级
        const client = createAIServiceClient(aiServiceUrl)
        const stillOnline = await client.checkHealth()
        if (!stillOnline) {
          showToast('AI 服务不可用，请检查 Docker 是否运行')
          return
        }
        result = await processWithAI(maskUrl)
        engineUsed = 'ai'
      } else {
        showToast('AI 离线：请运行 docker compose up -d，或切换「简单修复」')
        return
      }

      if (result) {
        setResultUrl(result)
        setLastEngine(engineUsed)
        showToast(
          engineUsed === 'ai'
            ? 'AI (LaMa) 修复完成'
            : '简单修复完成（局部可能模糊，建议使用 AI 模式）',
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '处理失败'
      showToast(msg)
    } finally {
      setProcessing(false)
    }
  }

  const handleDownload = async () => {
    if (!resultUrl || !image) return
    const baseName = image.file.name.replace(/\.[^.]+$/, '')
    await saveImage(resultUrl, `${baseName}-removed.png`)
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <PanelSection title="处理模式">
        <div className="space-y-2">
          {modes.map((m) => (
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

      {mode === 'manual' && (
        <div className="rounded-lg border border-teal-brand/20 bg-teal-50 p-3 text-xs text-teal-900">
          <p className="font-medium mb-1">文字水印标记技巧</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>用矩形工具<strong>紧贴文字边缘</strong>框选，系统会自动收紧 mask</li>
            <li>选区越小越清晰；半透明水印建议用画笔</li>
          </ul>
        </div>
      )}

      {lastEngine === 'ai' && resultUrl && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">
          ✓ 已使用 AI (LaMa) 修复，非 mask 区域保持原图清晰
        </div>
      )}

      {lastEngine === 'opencv' && resultUrl && (
        <div className="rounded-lg border border-amber-accent/30 bg-amber-50 p-3 text-xs text-amber-800">
          当前结果为简单修复，画质可能偏模糊。启动 Docker AI 服务后可获得更清晰效果。
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

      {mode === 'simple' && (
        <div className="rounded-lg border border-amber-accent/30 bg-amber-50 p-3 text-xs text-amber-800">
          简单修复使用 OpenCV 算法，仅适合小面积半透明文字水印。复杂水印请启动本机 AI 服务。
        </div>
      )}

      {(mode === 'auto' || mode === 'manual') && !aiOnline && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          AI 服务离线。文字去水印必须启用 AI 才清晰，请运行 <code className="bg-red-100 px-1 rounded">docker compose up -d</code>
        </div>
      )}

      {resultUrl && (
        <PanelSection title="前后对比">
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

      <div className="mt-auto space-y-2">
        <button
          type="button"
          onClick={handleProcess}
          disabled={processing || !image}
          className="w-full rounded-xl bg-teal-brand py-3 text-sm font-semibold text-white hover:bg-teal-brand-dark disabled:opacity-50"
        >
          {processing ? '处理中…' : mode === 'auto' ? '自动去水印' : '开始修复'}
        </button>
        {resultUrl && (
          <>
            <button
              type="button"
              onClick={() => setResultUrl(null)}
              className="w-full rounded-xl border border-[var(--color-border)] py-2.5 text-sm font-medium hover:bg-slate-50"
            >
              清除预览，重新标记
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="w-full rounded-xl border border-teal-brand py-2.5 text-sm font-medium text-teal-brand hover:bg-teal-brand/5"
            >
              保存结果
            </button>
          </>
        )}
      </div>
    </div>
  )
}
