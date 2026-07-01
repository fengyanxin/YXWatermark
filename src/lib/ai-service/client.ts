export interface AIServiceClient {
  checkHealth(): Promise<boolean>
  inpaint(image: Blob, mask: Blob, options?: InpaintOptions): Promise<Blob>
}

export interface InpaintOptions {
  width: number
  height: number
  /** 文字水印：更小 crop 边距、零 mask 模糊，追求锐利边缘 */
  textWatermark?: boolean
}

/** 文字水印专用参数：Crop + 小边距 + 零模糊 */
function buildInpaintFormFields(options?: InpaintOptions): Record<string, string> {
  const maxDim = options ? Math.max(options.width, options.height) : 1920
  const textMode = options?.textWatermark ?? true

  return {
    ldmSteps: '1',
    ldmSampler: 'ddim',
    // 文字水印始终 Crop，只处理局部
    hdStrategy: maxDim > 512 ? 'Crop' : 'Original',
    zitsWireframe: 'false',
    // 文字水印用小边距，减少整块替换带来的模糊
    hdStrategyCropMargin: textMode ? '64' : '128',
    hdStrategyCropTrigerSize: '512',
    hdStrategyResizeLimit: '4096',
    prompt: '',
    negativePrompt: '',
    useCroper: 'false',
    croperX: '0',
    croperY: '0',
    croperHeight: '512',
    croperWidth: '512',
    sdScale: '1.0',
    // 0 = 锐利 mask，文字去水印不能加模糊
    sdMaskBlur: '0',
    sdStrength: '0.75',
    sdSteps: '50',
    sdGuidanceScale: '7.5',
    sdSampler: 'uni_pc',
    sdSeed: '42',
    sdMatchHistograms: 'false',
    cv2Flag: 'INPAINT_NS',
    cv2Radius: '4',
    paintByExampleSteps: '50',
    paintByExampleGuidanceScale: '7.5',
    paintByExampleMaskBlur: '0',
    paintByExampleSeed: '42',
    paintByExampleMatchHistograms: 'false',
    p2pSteps: '50',
    p2pImageGuidanceScale: '7.5',
    p2pGuidanceScale: '7.5',
    controlnet_conditioning_scale: '0.4',
    controlnet_method: 'control_v11p_sd15_canny',
  }
}

export function createAIServiceClient(baseUrl: string): AIServiceClient {
  const normalized = baseUrl.replace(/\/$/, '')

  return {
    async checkHealth() {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 3000)
        const res = await fetch(normalized, {
          method: 'GET',
          signal: controller.signal,
        })
        clearTimeout(timeout)
        return res.ok
      } catch {
        return false
      }
    },

    async inpaint(image: Blob, mask: Blob, options?: InpaintOptions) {
      const form = new FormData()
      form.append('image', image, 'image.png')
      form.append('mask', mask, 'mask.png')
      for (const [key, value] of Object.entries(buildInpaintFormFields(options))) {
        form.append(key, value)
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 120_000)

      let res: Response
      try {
        res = await fetch(`${normalized}/inpaint`, {
          method: 'POST',
          body: form,
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeout)
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(parseAIError(text) || `AI 服务错误 (${res.status})`)
      }

      const contentType = res.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const data = (await res.json()) as { image?: string; error?: string }
        if (data.error) throw new Error(data.error)
        if (data.image) return base64ToBlob(data.image)
        throw new Error('AI 服务未返回图片')
      }

      return res.blob()
    },
  }
}

function parseAIError(text: string): string | null {
  if (!text) return null
  if (text.includes('<html') || text.includes('<!doctype')) {
    if (text.includes('Bad Request')) return 'AI 服务无法理解请求，请检查 mask 是否有效'
    return 'AI 服务请求失败'
  }
  return text.length > 120 ? text.slice(0, 120) + '…' : text
}

export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}

function base64ToBlob(b64: string): Blob {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: 'image/png' })
}
