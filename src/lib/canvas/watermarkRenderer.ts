import type { GridPosition, TileConfig, WatermarkConfig } from '@/types'
import { gridPositionToCoords } from '@/lib/utils/image'

interface DrawContext {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
}

function applyTextStyle(
  ctx: CanvasRenderingContext2D,
  fontSize: number,
  color: string,
  opacity: number,
  rotation: number,
) {
  ctx.font = `600 ${fontSize}px "Noto Sans SC", "DM Sans", sans-serif`
  ctx.fillStyle = color
  ctx.globalAlpha = opacity / 100
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.rotate((rotation * Math.PI) / 180)
}

function drawTextAt(
  { ctx }: DrawContext,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  color: string,
  opacity: number,
  rotation: number,
) {
  ctx.save()
  ctx.translate(x, y)
  applyTextStyle(ctx, fontSize, color, opacity, rotation)
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

async function drawLogoAt(
  { ctx }: DrawContext,
  imageUrl: string,
  x: number,
  y: number,
  scale: number,
  opacity: number,
  rotation: number,
) {
  const img = await getCachedImage(imageUrl)
  drawLogoFromImage({ ctx, width: 0, height: 0 }, img, x, y, scale, opacity, rotation)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

const imageCache = new Map<string, HTMLImageElement>()

async function getCachedImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src)
  if (cached) return cached
  const img = await loadImage(src)
  imageCache.set(src, img)
  return img
}

export async function preloadWatermarkAssets(config: WatermarkConfig): Promise<void> {
  if (config.logo.enabled && config.logo.imageUrl) {
    await getCachedImage(config.logo.imageUrl)
  }
}

function drawLogoFromImage(
  { ctx }: DrawContext,
  img: HTMLImageElement,
  x: number,
  y: number,
  scale: number,
  opacity: number,
  rotation: number,
) {
  const w = (img.width * scale) / 100
  const h = (img.height * scale) / 100
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.globalAlpha = opacity / 100
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  ctx.restore()
}

function drawTiledLogoFromImage(
  dc: DrawContext,
  img: HTMLImageElement,
  scale: number,
  opacity: number,
  tile: TileConfig,
) {
  const { ctx, width, height } = dc
  const w = (img.width * scale) / 100
  const h = (img.height * scale) / 100
  const spacingX = Math.max(tile.spacingX, w + 20)
  const spacingY = Math.max(tile.spacingY, h + 20)
  const rad = (tile.rotation * Math.PI) / 180
  const diag = Math.sqrt(width * width + height * height)

  ctx.save()
  ctx.translate(width / 2, height / 2)
  ctx.rotate(rad)
  ctx.globalAlpha = opacity / 100

  for (let y = -diag; y <= diag; y += spacingY) {
    for (let x = -diag; x <= diag; x += spacingX) {
      ctx.drawImage(img, x - w / 2, y - h / 2, w, h)
    }
  }
  ctx.restore()
}

function drawTiledText(
  dc: DrawContext,
  text: string,
  fontSize: number,
  color: string,
  opacity: number,
  tile: TileConfig,
) {
  const { ctx, width, height } = dc
  const spacingX = Math.max(tile.spacingX, fontSize * 2)
  const spacingY = Math.max(tile.spacingY, fontSize * 2)
  const rad = (tile.rotation * Math.PI) / 180
  const diag = Math.sqrt(width * width + height * height)

  ctx.save()
  ctx.translate(width / 2, height / 2)
  ctx.rotate(rad)

  for (let y = -diag; y <= diag; y += spacingY) {
    for (let x = -diag; x <= diag; x += spacingX) {
      ctx.save()
      ctx.translate(x, y)
      applyTextStyle(ctx, fontSize, color, opacity, 0)
      ctx.fillText(text, 0, 0)
      ctx.restore()
    }
  }
  ctx.restore()
}

async function drawTiledLogo(
  dc: DrawContext,
  imageUrl: string,
  scale: number,
  opacity: number,
  tile: TileConfig,
) {
  const img = await getCachedImage(imageUrl)
  drawTiledLogoFromImage(dc, img, scale, opacity, tile)
}

function drawSingleWatermark(
  dc: DrawContext,
  config: WatermarkConfig,
  position: GridPosition,
  offsetX: number,
  offsetY: number,
) {
  const { width, height } = dc
  const { x, y } = gridPositionToCoords(position, width, height, offsetX, offsetY)

  if (config.text.enabled) {
    drawTextAt(
      dc,
      config.text.text,
      x,
      y,
      config.text.fontSize,
      config.text.color,
      config.text.opacity,
      config.text.rotation,
    )
  }
}

async function drawSingleLogo(
  dc: DrawContext,
  config: WatermarkConfig,
  position: GridPosition,
  offsetX: number,
  offsetY: number,
) {
  if (!config.logo.enabled || !config.logo.imageUrl) return
  const { width, height } = dc
  const { x, y } = gridPositionToCoords(position, width, height, offsetX, offsetY)
  await drawLogoAt(
    dc,
    config.logo.imageUrl,
    x,
    y,
    config.logo.scale,
    config.logo.opacity,
    config.logo.rotation,
  )
}

/** 同步绘制（视频逐帧导出，Logo 需先 preload） */
export function drawWatermarksOnContextSync(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: WatermarkConfig,
): void {
  const dc: DrawContext = { ctx, width, height }
  const logoImg =
    config.logo.enabled && config.logo.imageUrl
      ? imageCache.get(config.logo.imageUrl) ?? null
      : null

  if (config.tile.enabled) {
    if (config.text.enabled) {
      drawTiledText(
        dc,
        config.text.text,
        config.text.fontSize,
        config.text.color,
        config.text.opacity,
        config.tile,
      )
    }
    if (logoImg) {
      drawTiledLogoFromImage(dc, logoImg, config.logo.scale, config.logo.opacity, config.tile)
    }
  } else {
    drawSingleWatermark(
      dc,
      config,
      config.text.position,
      config.text.offsetX,
      config.text.offsetY,
    )
    if (logoImg) {
      const { x, y } = gridPositionToCoords(
        config.logo.position,
        width,
        height,
        config.logo.offsetX,
        config.logo.offsetY,
      )
      drawLogoFromImage(dc, logoImg, x, y, config.logo.scale, config.logo.opacity, config.logo.rotation)
    }
  }
}

/** 在已有 canvas 上下文上绘制水印（视频逐帧复用） */
export async function drawWatermarksOnContext(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: WatermarkConfig,
): Promise<void> {
  const dc: DrawContext = { ctx, width, height }

  if (config.tile.enabled) {
    if (config.text.enabled) {
      drawTiledText(
        dc,
        config.text.text,
        config.text.fontSize,
        config.text.color,
        config.text.opacity,
        config.tile,
      )
    }
    if (config.logo.enabled && config.logo.imageUrl) {
      await drawTiledLogo(
        dc,
        config.logo.imageUrl,
        config.logo.scale,
        config.logo.opacity,
        config.tile,
      )
    }
  } else {
    drawSingleWatermark(
      dc,
      config,
      config.text.position,
      config.text.offsetX,
      config.text.offsetY,
    )
    await drawSingleLogo(
      dc,
      config,
      config.logo.position,
      config.logo.offsetX,
      config.logo.offsetY,
    )
  }
}

export async function renderWatermarkedImage(
  imageUrl: string,
  width: number,
  height: number,
  config: WatermarkConfig,
): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')

  const baseImg = await loadImage(imageUrl)
  ctx.drawImage(baseImg, 0, 0, width, height)

  await drawWatermarksOnContext(ctx, width, height, config)

  return canvas.toDataURL('image/png')
}

export async function exportWatermarkedImage(
  imageUrl: string,
  width: number,
  height: number,
  config: WatermarkConfig,
  format: 'png' | 'jpeg',
  jpegQuality: number,
): Promise<string> {
  const pngData = await renderWatermarkedImage(imageUrl, width, height, config)
  if (format === 'png') return pngData

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 不可用')

  const img = await loadImage(pngData)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL('image/jpeg', jpegQuality / 100)
}
