export interface Subtitle {
  id: string
  start: number
  end: number
  text: string
}

export type SubtitlePosition = 'top' | 'middle' | 'bottom' | 'custom'

export interface SubtitleStyle {
  fontFamily: string
  fontSize: number
  color: string
  strokeColor: string
  strokeWidth: number
  background: boolean
  backgroundColor: string
  backgroundOpacity: number
  position: SubtitlePosition
  customY: number
}

export interface Watermark {
  imageDataUrl: string | null
  width: number
  position:
    | 'top-left'
    | 'top'
    | 'top-right'
    | 'left'
    | 'center'
    | 'right'
    | 'bottom-left'
    | 'bottom'
    | 'bottom-right'
  opacity: number
  marginX: number
  marginY: number
}

export interface VideoMeta {
  name: string
  type: string
  size: number
  duration: number
  width: number
  height: number
}

export interface CustomFont {
  id: string
  family: string
  data: ArrayBuffer
}

export interface ProjectSnapshot {
  videoBlob: Blob | null
  videoMeta: VideoMeta | null
  subtitles: Subtitle[]
  style: SubtitleStyle
  watermark: Watermark
  customFonts: CustomFont[]
}

export const DEFAULT_STYLE: SubtitleStyle = {
  fontFamily: 'sans-serif',
  fontSize: 48,
  color: '#ffffff',
  strokeColor: '#000000',
  strokeWidth: 4,
  background: false,
  backgroundColor: '#000000',
  backgroundOpacity: 0.5,
  position: 'bottom',
  customY: 0.85,
}

export const DEFAULT_WATERMARK: Watermark = {
  imageDataUrl: null,
  width: 0.15,
  position: 'bottom-right',
  opacity: 0.85,
  marginX: 0.03,
  marginY: 0.03,
}
