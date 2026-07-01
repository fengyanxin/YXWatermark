import { useState } from 'react'
import { useAddWatermarkStore } from '@/stores/addWatermarkStore'
import { GridPositionPicker } from '@/components/GridPositionPicker'
import { PanelSection, SliderField, ToggleField } from '@/components/PanelSection'

type ControlTab = 'text' | 'logo' | 'tile'

export function WatermarkControls() {
  const config = useAddWatermarkStore((s) => s.config)
  const setConfig = useAddWatermarkStore((s) => s.setConfig)
  const exportFormat = useAddWatermarkStore((s) => s.exportFormat)
  const setExportFormat = useAddWatermarkStore((s) => s.setExportFormat)
  const jpegQuality = useAddWatermarkStore((s) => s.jpegQuality)
  const setJpegQuality = useAddWatermarkStore((s) => s.setJpegQuality)
  const [tab, setTab] = useState<ControlTab>('text')

  const tabs: { id: ControlTab; label: string }[] = [
    { id: 'text', label: '文字' },
    { id: 'logo', label: 'Logo' },
    { id: 'tile', label: '平铺' },
  ]

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setConfig((c) => ({
      ...c,
      logo: { ...c.logo, enabled: true, imageUrl: url },
    }))
    e.target.value = ''
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-all ${
              tab === t.id ? 'bg-white text-teal-brand shadow-sm' : 'text-[var(--color-muted)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto pr-1">
        {tab === 'text' && (
          <>
            <ToggleField
              label="启用文字水印"
              checked={config.text.enabled}
              onChange={(v) => setConfig((c) => ({ ...c, text: { ...c.text, enabled: v } }))}
            />
            <label className="block space-y-1.5">
              <span className="text-sm">水印文字</span>
              <input
                type="text"
                value={config.text.text}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, text: { ...c.text, text: e.target.value } }))
                }
                className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-teal-brand"
              />
            </label>
            <SliderField
              label="字号"
              value={config.text.fontSize}
              min={12}
              max={120}
              onChange={(v) => setConfig((c) => ({ ...c, text: { ...c.text, fontSize: v } }))}
            />
            <label className="block space-y-1.5">
              <span className="text-sm">颜色</span>
              <input
                type="color"
                value={config.text.color}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, text: { ...c.text, color: e.target.value } }))
                }
                className="h-10 w-full cursor-pointer rounded-lg border border-[var(--color-border)]"
              />
            </label>
            <SliderField
              label="透明度"
              value={config.text.opacity}
              min={10}
              max={100}
              unit="%"
              onChange={(v) => setConfig((c) => ({ ...c, text: { ...c.text, opacity: v } }))}
            />
            <SliderField
              label="旋转角度"
              value={config.text.rotation}
              min={-180}
              max={180}
              unit="°"
              onChange={(v) => setConfig((c) => ({ ...c, text: { ...c.text, rotation: v } }))}
            />
            {!config.tile.enabled && (
              <>
                <PanelSection title="位置">
                  <GridPositionPicker
                    value={config.text.position}
                    onChange={(pos) =>
                      setConfig((c) => ({ ...c, text: { ...c.text, position: pos } }))
                    }
                  />
                </PanelSection>
                <SliderField
                  label="水平偏移"
                  value={config.text.offsetX}
                  min={-200}
                  max={200}
                  onChange={(v) =>
                    setConfig((c) => ({ ...c, text: { ...c.text, offsetX: v } }))
                  }
                />
                <SliderField
                  label="垂直偏移"
                  value={config.text.offsetY}
                  min={-200}
                  max={200}
                  onChange={(v) =>
                    setConfig((c) => ({ ...c, text: { ...c.text, offsetY: v } }))
                  }
                />
              </>
            )}
          </>
        )}

        {tab === 'logo' && (
          <>
            <ToggleField
              label="启用 Logo 水印"
              checked={config.logo.enabled}
              onChange={(v) => setConfig((c) => ({ ...c, logo: { ...c.logo, enabled: v } }))}
            />
            <label className="block">
              <span className="mb-1.5 block text-sm">上传 Logo（PNG/WebP）</span>
              <input
                type="file"
                accept="image/png,image/webp"
                onChange={handleLogoUpload}
                className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-teal-brand file:px-3 file:py-1.5 file:text-sm file:text-white"
              />
            </label>
            {config.logo.imageUrl && (
              <img
                src={config.logo.imageUrl}
                alt="Logo"
                className="mx-auto h-16 object-contain"
              />
            )}
            <SliderField
              label="缩放"
              value={config.logo.scale}
              min={10}
              max={200}
              unit="%"
              onChange={(v) => setConfig((c) => ({ ...c, logo: { ...c.logo, scale: v } }))}
            />
            <SliderField
              label="透明度"
              value={config.logo.opacity}
              min={10}
              max={100}
              unit="%"
              onChange={(v) => setConfig((c) => ({ ...c, logo: { ...c.logo, opacity: v } }))}
            />
            <SliderField
              label="旋转角度"
              value={config.logo.rotation}
              min={-180}
              max={180}
              unit="°"
              onChange={(v) => setConfig((c) => ({ ...c, logo: { ...c.logo, rotation: v } }))}
            />
            {!config.tile.enabled && (
              <>
                <PanelSection title="位置">
                  <GridPositionPicker
                    value={config.logo.position}
                    onChange={(pos) =>
                      setConfig((c) => ({ ...c, logo: { ...c.logo, position: pos } }))
                    }
                  />
                </PanelSection>
                <SliderField
                  label="水平偏移"
                  value={config.logo.offsetX}
                  min={-200}
                  max={200}
                  onChange={(v) =>
                    setConfig((c) => ({ ...c, logo: { ...c.logo, offsetX: v } }))
                  }
                />
                <SliderField
                  label="垂直偏移"
                  value={config.logo.offsetY}
                  min={-200}
                  max={200}
                  onChange={(v) =>
                    setConfig((c) => ({ ...c, logo: { ...c.logo, offsetY: v } }))
                  }
                />
              </>
            )}
          </>
        )}

        {tab === 'tile' && (
          <>
            <ToggleField
              label="启用平铺模式"
              checked={config.tile.enabled}
              onChange={(v) => setConfig((c) => ({ ...c, tile: { ...c.tile, enabled: v } }))}
            />
            <p className="text-xs text-[var(--color-muted)]">
              平铺模式下，已启用的文字/Logo 水印将铺满整张图片
            </p>
            <SliderField
              label="水平间距"
              value={config.tile.spacingX}
              min={80}
              max={400}
              onChange={(v) => setConfig((c) => ({ ...c, tile: { ...c.tile, spacingX: v } }))}
            />
            <SliderField
              label="垂直间距"
              value={config.tile.spacingY}
              min={60}
              max={400}
              onChange={(v) => setConfig((c) => ({ ...c, tile: { ...c.tile, spacingY: v } }))}
            />
            <SliderField
              label="平铺角度"
              value={config.tile.rotation}
              min={-90}
              max={90}
              unit="°"
              onChange={(v) => setConfig((c) => ({ ...c, tile: { ...c.tile, rotation: v } }))}
            />
          </>
        )}

        <PanelSection title="导出">
          <div className="flex gap-2">
            {(['png', 'jpeg'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setExportFormat(f)}
                className={`flex-1 rounded-lg border py-2 text-sm uppercase ${
                  exportFormat === f
                    ? 'border-teal-brand bg-teal-brand/10 text-teal-brand'
                    : 'border-[var(--color-border)]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {exportFormat === 'jpeg' && (
            <SliderField
              label="JPEG 质量"
              value={jpegQuality}
              min={60}
              max={100}
              unit="%"
              onChange={setJpegQuality}
            />
          )}
        </PanelSection>
      </div>
    </div>
  )
}
