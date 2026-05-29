import {
  DEFAULT_STYLE,
  DEFAULT_WATERMARK,
  type SubtitleStyle,
  type Watermark,
} from '@/types'

const APP = 'subtitler'
const KIND = 'settings'
const VERSION = 1

export interface SettingsFile {
  app: typeof APP
  kind: typeof KIND
  version: number
  style: SubtitleStyle
  watermark: Watermark
}

export interface ParsedSettings {
  style: Partial<SubtitleStyle>
  watermark: Partial<Watermark>
}

export function serializeSettings(style: SubtitleStyle, watermark: Watermark): string {
  const data: SettingsFile = { app: APP, kind: KIND, version: VERSION, style, watermark }
  return JSON.stringify(data, null, 2)
}

/**
 * Keep only keys present in `defaults` whose value matches the default's type.
 * Drops unknown/garbage keys and type-mismatched values so an imported file
 * can never inject unexpected shapes into the store.
 */
function sanitize<T extends object>(raw: unknown, defaults: T): Partial<T> {
  if (typeof raw !== 'object' || raw === null) return {}
  const out: Partial<T> = {}
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const value = (raw as Record<string, unknown>)[key as string]
    if (value === undefined) continue
    const expected = typeof defaults[key]
    // watermark.imageDataUrl is `string | null`, so allow null there.
    if (value === null && defaults[key] === null) {
      out[key] = value as T[keyof T]
      continue
    }
    if (typeof value === expected) out[key] = value as T[keyof T]
  }
  return out
}

export function parseSettings(text: string): ParsedSettings {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('不是有效的 JSON 檔')
  }
  if (typeof json !== 'object' || json === null) {
    throw new Error('設定檔格式錯誤')
  }
  const obj = json as Record<string, unknown>
  if (obj.app !== APP || obj.kind !== KIND) {
    throw new Error('這不是 Subtitler 的設定檔')
  }
  const style = sanitize(obj.style, DEFAULT_STYLE)
  const watermark = sanitize(obj.watermark, DEFAULT_WATERMARK)
  if (Object.keys(style).length === 0 && Object.keys(watermark).length === 0) {
    throw new Error('設定檔沒有可套用的內容')
  }
  return { style, watermark }
}
