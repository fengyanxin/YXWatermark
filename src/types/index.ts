export type MediaType = 'image' | 'video'

export type AppTab = 'add' | 'remove'

export type GridPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export interface TextWatermarkConfig {
  enabled: boolean
  text: string
  fontSize: number
  color: string
  opacity: number
  rotation: number
  position: GridPosition
  offsetX: number
  offsetY: number
}

export interface LogoWatermarkConfig {
  enabled: boolean
  imageUrl: string | null
  scale: number
  opacity: number
  rotation: number
  position: GridPosition
  offsetX: number
  offsetY: number
}

export interface TileConfig {
  enabled: boolean
  spacingX: number
  spacingY: number
  rotation: number
}

export interface WatermarkConfig {
  text: TextWatermarkConfig
  logo: LogoWatermarkConfig
  tile: TileConfig
}

export type ExportFormat = 'png' | 'jpeg'

export type RemoveMode = 'auto' | 'manual' | 'simple'

export type MaskTool = 'brush' | 'rect'

export interface ImageFile {
  file: File
  url: string
  width: number
  height: number
}

export interface VideoFile {
  file: File
  url: string
  width: number
  height: number
  duration: number
  /** 原片帧率，导出时不低于此值 */
  fps: number
  /** 预计导出帧数（duration × fps，上传时计算） */
  frameCount?: number
  /** 首帧预览图（上传时抓取） */
  firstFrameUrl: string
}

export const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
  text: {
    enabled: true,
    text: 'YXWatermark',
    fontSize: 36,
    color: '#ffffff',
    opacity: 60,
    rotation: -30,
    position: 'bottom-right',
    offsetX: 0,
    offsetY: 0,
  },
  logo: {
    enabled: false,
    imageUrl: null,
    scale: 100,
    opacity: 80,
    rotation: 0,
    position: 'bottom-right',
    offsetX: 0,
    offsetY: 0,
  },
  tile: {
    enabled: false,
    spacingX: 200,
    spacingY: 150,
    rotation: -30,
  },
}

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_IMAGE_SIZE = 20 * 1024 * 1024

export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
export const MAX_VIDEO_SIZE = 500 * 1024 * 1024
export const MAX_VIDEO_DURATION = 60
/** 无法探测原片帧率时的回退值 */
export const DEFAULT_VIDEO_FPS = 30

export type VideoExportFormat = 'webm' | 'mp4'
