export interface Subtitle {
  id: string
  start: number
  end: number
  text: string
}

export type SubtitlePosition = 'top' | 'middle' | 'bottom' | 'custom'
export type SubtitleHorizontalPosition = 'left' | 'center' | 'right' | 'custom'

/** Visual text styling shared by subtitles and free-floating text labels. */
export interface TextStyleCore {
  fontFamily: string
  fontSize: number
  color: string
  strokeColor: string
  strokeWidth: number
  background: boolean
  backgroundColor: string
  backgroundOpacity: number
  backgroundRadius: number
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
}

export interface SubtitleStyle extends TextStyleCore {
  position: SubtitlePosition
  customY: number
  positionX: SubtitleHorizontalPosition
  customX: number
}

/** A text label placed at an arbitrary position, shown for the whole video. */
export interface TextLabel extends TextStyleCore {
  id: string
  text: string
  /** Normalized [0,1] center position relative to the video frame. */
  x: number
  y: number
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
  shape: 'rect' | 'circle'
  vinyl: boolean
  vinylThickness: number
  rotateRpm: number
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
  labels: TextLabel[]
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
  backgroundRadius: 0,
  position: 'bottom',
  customY: 0.85,
  positionX: 'center',
  customX: 0.5,
  bold: true,
  italic: false,
  underline: false,
  strikethrough: false,
}

export const DEFAULT_LABEL_STYLE: TextStyleCore = {
  fontFamily: 'sans-serif',
  fontSize: 48,
  color: '#ffffff',
  strokeColor: '#000000',
  strokeWidth: 4,
  background: false,
  backgroundColor: '#000000',
  backgroundOpacity: 0.5,
  backgroundRadius: 0,
  bold: true,
  italic: false,
  underline: false,
  strikethrough: false,
}

export const DEFAULT_WATERMARK: Watermark = {
  imageDataUrl: null,
  width: 0.15,
  position: 'bottom-right',
  opacity: 0.85,
  marginX: 0.03,
  marginY: 0.03,
  shape: 'rect',
  vinyl: false,
  vinylThickness: 0.7,
  rotateRpm: 0,
}
