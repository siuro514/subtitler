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

/**
 * A subtitle/lyric track. Owns its style and on-screen placement (position,
 * scale, rotation); its cues share that placement and differ only in time/text.
 * A "label" is just a track with a single always-on, freely-positioned cue.
 */
export interface Track extends SubtitleStyle {
  id: string
  name: string
  cues: Subtitle[]
  /** Clockwise rotation of the text block in degrees. */
  rotation: number
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
  tracks: Track[]
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

/** Default placement extras for a new track (on top of DEFAULT_STYLE). */
export const DEFAULT_TRACK_EXTRAS = {
  rotation: 0,
} as const

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
