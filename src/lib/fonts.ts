export interface FontOption {
  family: string
  label: string
  group: 'system' | 'web' | 'custom'
}

export const SYSTEM_FONTS: FontOption[] = [
  { family: 'sans-serif', label: '系統 sans-serif', group: 'system' },
  { family: 'serif', label: '系統 serif', group: 'system' },
  { family: 'monospace', label: '系統等寬', group: 'system' },
  { family: '"PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif', label: '中文黑體', group: 'system' },
  { family: '"PingFang TC", "Microsoft JhengHei Bold", sans-serif', label: '中文粗體', group: 'system' },
  { family: '"Helvetica Neue", Helvetica, Arial, sans-serif', label: 'Helvetica', group: 'system' },
  { family: '"Arial Black", sans-serif', label: 'Arial Black', group: 'system' },
  { family: '"Times New Roman", Times, serif', label: 'Times New Roman', group: 'system' },
  { family: 'Georgia, serif', label: 'Georgia', group: 'system' },
  { family: 'Verdana, sans-serif', label: 'Verdana', group: 'system' },
  { family: 'Tahoma, sans-serif', label: 'Tahoma', group: 'system' },
  { family: 'Impact, sans-serif', label: 'Impact', group: 'system' },
  { family: '"Courier New", Courier, monospace', label: 'Courier', group: 'system' },
]

export const WEB_FONTS: FontOption[] = [
  { family: '"Inter", sans-serif', label: 'Inter', group: 'web' },
  { family: '"Roboto", sans-serif', label: 'Roboto', group: 'web' },
  { family: '"Poppins", sans-serif', label: 'Poppins', group: 'web' },
  { family: '"Montserrat", sans-serif', label: 'Montserrat', group: 'web' },
  { family: '"Lora", serif', label: 'Lora', group: 'web' },
  { family: '"Playfair Display", serif', label: 'Playfair Display', group: 'web' },
  { family: '"Bebas Neue", sans-serif', label: 'Bebas Neue', group: 'web' },
  { family: '"JetBrains Mono", monospace', label: 'JetBrains Mono', group: 'web' },
  { family: '"Noto Sans TC", sans-serif', label: 'Noto Sans TC (中)', group: 'web' },
  { family: '"Noto Serif TC", serif', label: 'Noto Serif TC (中)', group: 'web' },
  { family: '"Zen Maru Gothic", sans-serif', label: 'Zen Maru Gothic (圓)', group: 'web' },
]

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2' +
  '?family=Inter:wght@400;700' +
  '&family=Roboto:wght@400;700' +
  '&family=Poppins:wght@400;700' +
  '&family=Montserrat:wght@400;700' +
  '&family=Lora:wght@400;700' +
  '&family=Playfair+Display:wght@400;700' +
  '&family=Bebas+Neue' +
  '&family=JetBrains+Mono:wght@400;700' +
  '&family=Noto+Sans+TC:wght@400;700' +
  '&family=Noto+Serif+TC:wght@400;700' +
  '&family=Zen+Maru+Gothic:wght@400;700' +
  '&display=swap'

export function injectGoogleFonts() {
  if (document.querySelector('link[data-google-fonts]')) return
  const pc1 = document.createElement('link')
  pc1.rel = 'preconnect'
  pc1.href = 'https://fonts.googleapis.com'
  document.head.appendChild(pc1)
  const pc2 = document.createElement('link')
  pc2.rel = 'preconnect'
  pc2.href = 'https://fonts.gstatic.com'
  pc2.crossOrigin = ''
  document.head.appendChild(pc2)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = GOOGLE_FONTS_URL
  link.setAttribute('data-google-fonts', '')
  document.head.appendChild(link)
}

export function firstFamily(fontFamily: string): string {
  const first = fontFamily.split(',')[0].trim()
  return first.replace(/^["']|["']$/g, '')
}

export async function ensureFontLoaded(
  fontFamily: string,
  fontSize: number,
  text: string,
): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return
  try {
    const family = firstFamily(fontFamily)
    const spec = `${Math.max(8, Math.round(fontSize))}px "${family}"`
    await document.fonts.load(spec, text || ' ')
  } catch {
    // best-effort; fall back is the next font in the stack
  }
}

export async function registerCustomFont(family: string, data: ArrayBuffer): Promise<void> {
  if (!('FontFace' in window)) throw new Error('瀏覽器不支援 FontFace API')
  const ff = new FontFace(family, data)
  await ff.load()
  document.fonts.add(ff)
}

export function isFontFamilyRegistered(family: string): boolean {
  if (!('fonts' in document)) return false
  const name = firstFamily(family)
  return document.fonts.check(`16px "${name}"`)
}
