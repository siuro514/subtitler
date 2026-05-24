import type { Subtitle } from '@/types'
import { uid } from '@/lib/utils'

export function makeDemoSubtitles(duration: number): Subtitle[] {
  const max = Math.max(2, duration)
  const items: Array<[number, number, string]> = [
    [0, Math.min(2, max), 'Subtitler — 即時預覽'],
    [Math.min(2, max), Math.min(5, max), '字幕會跟著影片時間軸跑'],
    [Math.min(5, max), Math.min(9, max), '右下角是浮水印\nlogo / watermark'],
    [Math.min(9, max), Math.min(13, max), '改樣式、改位置都會立即反映'],
  ]
  return items
    .filter(([s, e]) => e > s)
    .map(([start, end, text]) => ({ id: uid(), start, end, text }))
}

export const DEMO_WATERMARK_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80">
      <rect width="200" height="80" rx="12" fill="rgba(0,0,0,0.55)"/>
      <text x="100" y="52" font-family="sans-serif" font-size="32" font-weight="700" fill="#fff" text-anchor="middle">DEMO</text>
    </svg>`,
  )
