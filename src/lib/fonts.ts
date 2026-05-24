export interface FontOption {
  family: string
  label: string
  group: 'system' | 'bundled' | 'web' | 'custom'
}

interface BundledFontDef {
  family: string
  file: string
  label: string
}

export const BUNDLED_FONTS_DEF: BundledFontDef[] = [
  { family: 'LXGW ZhenKai', file: 'lxgw-zhenkai.woff2', label: '霞鶩臻楷（楷）' },
  { family: 'LXGW Yozai', file: 'yozai.woff2', label: '悠哉字體（手寫）' },
  { family: 'LXGW Xiaolai', file: 'xiaolai.woff2', label: '小賴字體（手寫）' },
  { family: 'LXGW Marker Gothic', file: 'marker.woff2', label: '霞鶩漫黑（麥克筆）' },
  { family: 'ChenYuluoyan', file: 'chenyuluoyan.woff2', label: '辰宇落雁體（手寫）' },
  { family: 'Naikai Font', file: 'naikai.woff2', label: '內海字體（手寫）' },
  { family: 'Bakudai Font', file: 'bakudai.woff2', label: '莫大毛筆字體（毛筆）' },
  { family: 'CEF Fonts CJK', file: 'cef.woff2', label: '快去寫作業 CJK（手寫）' },
  { family: 'Jason Handwriting 1', file: 'jason1.woff2', label: '清松手寫體 1' },
  { family: 'Jason Handwriting 2', file: 'jason2.woff2', label: '清松手寫體 2' },
  { family: 'Jason Handwriting 3', file: 'jason3.woff2', label: '清松手寫體 3' },
  { family: 'Jason Handwriting 3p', file: 'jason3p.woff2', label: '清松手寫體 3p' },
  { family: 'Jason Handwriting 4', file: 'jason4.woff2', label: '清松手寫體 4' },
  { family: 'Jason Handwriting 5', file: 'jason5.woff2', label: '清松手寫體 5' },
  { family: 'Jason Handwriting 5p', file: 'jason5p.woff2', label: '清松手寫體 5p' },
  { family: 'Jason Handwriting 6', file: 'jason6.woff2', label: '清松手寫體 6' },
  { family: 'Jason Handwriting 6p', file: 'jason6p.woff2', label: '清松手寫體 6p' },
  { family: 'Jason Handwriting 7', file: 'jason7.woff2', label: '清松手寫體 7' },
  { family: 'Jason Handwriting 7p', file: 'jason7p.woff2', label: '清松手寫體 7p' },
  { family: 'Jason Handwriting 8', file: 'jason8.woff2', label: '清松手寫體 8' },
  { family: 'Jason Handwriting 8p', file: 'jason8p.woff2', label: '清松手寫體 8p' },
  { family: 'Jason Handwriting 9', file: 'jason9.woff2', label: '清松手寫體 9' },
  { family: 'Jason Handwriting 9p', file: 'jason9p.woff2', label: '清松手寫體 9p' },
  { family: '851 Tegaki Zatsu', file: '851tegaki.woff2', label: '851 手寫雜（手寫）' },
  { family: 'StayHome AutoPen', file: 'zhz-autopen.woff2', label: '宅在家自動筆（手寫）' },
  { family: 'StayHome Funtao', file: 'zhz-funtao.woff2', label: '宅在家粉條甜（手寫）' },
]

export const BUNDLED_FONTS: FontOption[] = BUNDLED_FONTS_DEF.map((f) => ({
  family: `"${f.family}", sans-serif`,
  label: f.label,
  group: 'bundled',
}))

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

export function injectBundledFonts() {
  if (document.querySelector('style[data-bundled-fonts]')) return
  const base = import.meta.env.BASE_URL || '/'
  const css = BUNDLED_FONTS_DEF.map(
    (f) =>
      `@font-face {
  font-family: "${f.family}";
  src: url("${base}fonts/${f.file}") format("woff2");
  font-display: swap;
  font-weight: 400;
  font-style: normal;
}`,
  ).join('\n')
  const style = document.createElement('style')
  style.setAttribute('data-bundled-fonts', '')
  style.textContent = css
  document.head.appendChild(style)
}

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
