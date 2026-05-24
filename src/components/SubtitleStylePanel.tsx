import { useRef, useState } from 'react'
import { Trash2, Upload } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { Field, Section } from './ui/Field'
import { BUNDLED_FONTS, SYSTEM_FONTS, WEB_FONTS } from '@/lib/fonts'

const POSITIONS = [
  { label: '上', value: 'top' },
  { label: '中', value: 'middle' },
  { label: '下', value: 'bottom' },
  { label: '自訂', value: 'custom' },
] as const

function deriveFamilyName(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  return base || 'Custom Font'
}

export function SubtitleStylePanel() {
  const style = useEditor((s) => s.style)
  const setStyle = useEditor((s) => s.setStyle)
  const customFonts = useEditor((s) => s.customFonts)
  const addCustomFont = useEditor((s) => s.addCustomFont)
  const removeCustomFont = useEditor((s) => s.removeCustomFont)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fontError, setFontError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFontFile(file: File) {
    setFontError(null)
    if (file.size > 8 * 1024 * 1024) {
      setFontError('字型檔超過 8MB')
      return
    }
    setUploading(true)
    try {
      const data = await file.arrayBuffer()
      let family = deriveFamilyName(file.name)
      const existing = new Set(customFonts.map((f) => f.family))
      let i = 2
      const base = family
      while (existing.has(family)) family = `${base} ${i++}`
      await addCustomFont(family, data)
      setStyle({ fontFamily: `"${family}"` })
    } catch (e) {
      setFontError(e instanceof Error ? e.message : '無法載入字型')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Section title="字幕樣式">
      <Field label="字型">
        <select
          className="w-full rounded-md border border-border bg-zinc-900 px-2 py-1.5 text-sm"
          value={style.fontFamily}
          onChange={(e) => setStyle({ fontFamily: e.target.value })}
        >
          <optgroup label="系統字型">
            {SYSTEM_FONTS.map((f) => (
              <option key={f.label} value={f.family}>
                {f.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="內建中文字型（OFL）">
            {BUNDLED_FONTS.map((f) => (
              <option key={f.label} value={f.family}>
                {f.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Web 字型（Google Fonts）">
            {WEB_FONTS.map((f) => (
              <option key={f.label} value={f.family}>
                {f.label}
              </option>
            ))}
          </optgroup>
          {customFonts.length > 0 && (
            <optgroup label="自訂字型">
              {customFonts.map((f) => (
                <option key={f.id} value={`"${f.family}"`}>
                  {f.family}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <div className="mt-1 flex items-center gap-2">
          <button
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-zinc-800 disabled:opacity-40"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-3 w-3" />
            {uploading ? '載入中…' : '上傳字型'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleFontFile(f)
              e.target.value = ''
            }}
          />
          {customFonts.length > 0 && (
            <details className="ml-auto text-xs">
              <summary className="cursor-pointer text-zinc-500 hover:text-zinc-300">
                管理（{customFonts.length}）
              </summary>
              <ul className="mt-2 space-y-1">
                {customFonts.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1">
                    <span className="truncate" title={f.family}>{f.family}</span>
                    <button
                      className="text-zinc-500 hover:text-red-400"
                      onClick={() => removeCustomFont(f.id)}
                      aria-label="移除"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        {fontError && <p className="mt-1 text-[10px] text-red-400">{fontError}</p>}
      </Field>

      <Field label={`字級 ${style.fontSize}`}>
        <input
          type="range"
          min={16}
          max={120}
          step={1}
          className="w-full accent-zinc-300"
          value={style.fontSize}
          onChange={(e) => setStyle({ fontSize: parseInt(e.target.value, 10) })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="主色">
          <input
            type="color"
            className="h-8 w-full rounded border border-border bg-zinc-900"
            value={style.color}
            onChange={(e) => setStyle({ color: e.target.value })}
          />
        </Field>
        <Field label="描邊色">
          <input
            type="color"
            className="h-8 w-full rounded border border-border bg-zinc-900"
            value={style.strokeColor}
            onChange={(e) => setStyle({ strokeColor: e.target.value })}
          />
        </Field>
      </div>

      <Field label={`描邊寬度 ${style.strokeWidth}`}>
        <input
          type="range"
          min={0}
          max={20}
          step={0.5}
          className="w-full accent-zinc-300"
          value={style.strokeWidth}
          onChange={(e) => setStyle({ strokeWidth: parseFloat(e.target.value) })}
        />
      </Field>

      <div className="space-y-2 rounded-md border border-border p-2">
        <label className="flex items-center justify-between text-xs font-medium text-zinc-300">
          <span>背景框</span>
          <input
            type="checkbox"
            checked={style.background}
            onChange={(e) => setStyle({ background: e.target.checked })}
          />
        </label>
        {style.background && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Field label="顏色">
              <input
                type="color"
                className="h-8 w-full rounded border border-border bg-zinc-900"
                value={style.backgroundColor}
                onChange={(e) => setStyle({ backgroundColor: e.target.value })}
              />
            </Field>
            <Field label={`不透明 ${Math.round(style.backgroundOpacity * 100)}%`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                className="w-full accent-zinc-300"
                value={style.backgroundOpacity}
                onChange={(e) => setStyle({ backgroundOpacity: parseFloat(e.target.value) })}
              />
            </Field>
          </div>
        )}
      </div>

      <Field label="位置">
        <div className="grid grid-cols-4 gap-1">
          {POSITIONS.map((p) => (
            <button
              key={p.value}
              className={
                'rounded-md border px-2 py-1 text-xs ' +
                (style.position === p.value
                  ? 'border-zinc-300 bg-zinc-800 text-zinc-100'
                  : 'border-border text-zinc-400 hover:bg-zinc-900')
              }
              onClick={() => setStyle({ position: p.value })}
            >
              {p.label}
            </button>
          ))}
        </div>
      </Field>

      {style.position === 'custom' && (
        <Field label={`自訂 Y ${Math.round(style.customY * 100)}%`}>
          <input
            type="range"
            min={0.05}
            max={0.95}
            step={0.01}
            className="w-full accent-zinc-300"
            value={style.customY}
            onChange={(e) => setStyle({ customY: parseFloat(e.target.value) })}
          />
        </Field>
      )}
    </Section>
  )
}
