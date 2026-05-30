import { useRef, useState } from 'react'
import { Bold, Italic, Plus, Strikethrough, Trash2, Underline, Upload } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { Field, Section } from './ui/Field'
import { BUNDLED_FONTS, SYSTEM_FONTS, WEB_FONTS } from '@/lib/fonts'
import { cn } from '@/lib/utils'

const POSITIONS = [
  { label: '上', value: 'top' },
  { label: '中', value: 'middle' },
  { label: '下', value: 'bottom' },
  { label: '自訂', value: 'custom' },
] as const

const POSITIONS_X = [
  { label: '左', value: 'left' },
  { label: '中', value: 'center' },
  { label: '右', value: 'right' },
  { label: '自訂', value: 'custom' },
] as const

function deriveFamilyName(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  return base || 'Custom Font'
}

export function SubtitleStylePanel() {
  const tracks = useEditor((s) => s.tracks)
  const activeTrackId = useEditor((s) => s.activeTrackId)
  const addTrack = useEditor((s) => s.addTrack)
  const removeTrack = useEditor((s) => s.removeTrack)
  const selectTrack = useEditor((s) => s.selectTrack)
  const updateTrack = useEditor((s) => s.updateTrack)
  const setStyle = useEditor((s) => s.setStyle)
  const pushHistory = useEditor((s) => s.pushHistory)
  const customFonts = useEditor((s) => s.customFonts)
  const addCustomFont = useEditor((s) => s.addCustomFont)
  const removeCustomFont = useEditor((s) => s.removeCustomFont)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fontError, setFontError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const style = tracks.find((t) => t.id === activeTrackId) ?? null

  const setStyleHist = (patch: Parameters<typeof setStyle>[0]) => {
    pushHistory()
    setStyle(patch)
  }
  const onSliderDown = () => pushHistory()
  const setTrack = (patch: Parameters<typeof updateTrack>[1]) => {
    if (style) updateTrack(style.id, patch)
  }

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
    <Section title="字幕軌">
      <ul className="space-y-1">
        {tracks.map((t) => (
          <li key={t.id}>
            <div
              className={cn(
                'flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm',
                t.id === activeTrackId
                  ? 'border-sky-500/60 bg-sky-500/10'
                  : 'border-border hover:bg-zinc-900',
              )}
            >
              <button
                className="min-w-0 flex-1 truncate text-left"
                onClick={() => selectTrack(t.id)}
                title={t.name}
              >
                {t.name} <span className="text-zinc-500">({t.cues.length})</span>
              </button>
              <button
                className="shrink-0 text-zinc-500 hover:text-red-400 disabled:opacity-30"
                onClick={() => removeTrack(t.id)}
                disabled={tracks.length <= 1}
                aria-label="刪除軌道"
                title={tracks.length <= 1 ? '至少保留一軌' : '刪除軌道'}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button
        className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
        onClick={() => addTrack()}
      >
        <Plus className="h-4 w-4" />
        新增軌道
      </button>

      {!style ? (
        <p className="text-[10px] text-zinc-500">新增一軌即可開始加字幕。每軌有獨立樣式與位置。</p>
      ) : (
        <div className="space-y-3 border-t border-border pt-3">
          <Field label="軌道名稱">
            <input
              type="text"
              className="w-full rounded-md border border-border bg-zinc-900 px-2 py-1.5 text-sm"
              value={style.name}
              onChange={(e) => setTrack({ name: e.target.value })}
            />
          </Field>

          <Field label="字型">
            <select
              className="w-full rounded-md border border-border bg-zinc-900 px-2 py-1.5 text-sm"
              value={style.fontFamily}
              onChange={(e) => setStyleHist({ fontFamily: e.target.value })}
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
                      <li
                        key={f.id}
                        className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1"
                      >
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

          <Field label="字體樣式">
            <div className="grid grid-cols-4 gap-1">
              {([
                { key: 'bold', icon: Bold, label: '粗體' },
                { key: 'italic', icon: Italic, label: '斜體' },
                { key: 'underline', icon: Underline, label: '底線' },
                { key: 'strikethrough', icon: Strikethrough, label: '刪除線' },
              ] as const).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  aria-label={label}
                  title={label}
                  onClick={() => setStyleHist({ [key]: !style[key] })}
                  className={cn(
                    'flex h-8 items-center justify-center rounded-md border text-xs',
                    style[key]
                      ? 'border-zinc-300 bg-zinc-700 text-zinc-100'
                      : 'border-border text-zinc-400 hover:bg-zinc-900',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </Field>

          <Field label={`字級 ${style.fontSize}`} hint="也可在預覽上拖右下角的點縮放">
            <input
              type="range"
              min={16}
              max={400}
              step={1}
              className="w-full accent-zinc-300"
              value={style.fontSize}
              onPointerDown={onSliderDown}
              onChange={(e) => setStyle({ fontSize: parseInt(e.target.value, 10) })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="主色">
              <input
                type="color"
                className="h-8 w-full rounded border border-border bg-zinc-900"
                value={style.color}
                onChange={(e) => setStyleHist({ color: e.target.value })}
              />
            </Field>
            <Field label="描邊色">
              <input
                type="color"
                className="h-8 w-full rounded border border-border bg-zinc-900"
                value={style.strokeColor}
                onChange={(e) => setStyleHist({ strokeColor: e.target.value })}
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
              onPointerDown={onSliderDown}
              onChange={(e) => setStyle({ strokeWidth: parseFloat(e.target.value) })}
            />
          </Field>

          <div className="space-y-2 rounded-md border border-border p-2">
            <label className="flex items-center justify-between text-xs font-medium text-zinc-300">
              <span>背景框</span>
              <input
                type="checkbox"
                checked={style.background}
                onChange={(e) => setStyleHist({ background: e.target.checked })}
              />
            </label>
            {style.background && (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="顏色">
                    <input
                      type="color"
                      className="h-8 w-full rounded border border-border bg-zinc-900"
                      value={style.backgroundColor}
                      onChange={(e) => setStyleHist({ backgroundColor: e.target.value })}
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
                      onPointerDown={onSliderDown}
                      onChange={(e) => setStyle({ backgroundOpacity: parseFloat(e.target.value) })}
                    />
                  </Field>
                </div>
                <Field label={`圓角 ${Math.round(style.backgroundRadius * 100)}%`}>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    className="w-full accent-zinc-300"
                    value={style.backgroundRadius}
                    onPointerDown={onSliderDown}
                    onChange={(e) => setStyle({ backgroundRadius: parseFloat(e.target.value) })}
                  />
                </Field>
              </div>
            )}
          </div>

          <Field label="垂直位置">
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
                  onClick={() => setStyleHist({ position: p.value })}
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
                onPointerDown={onSliderDown}
                onChange={(e) => setStyle({ customY: parseFloat(e.target.value) })}
              />
            </Field>
          )}

          <Field label="水平位置">
            <div className="grid grid-cols-4 gap-1">
              {POSITIONS_X.map((p) => (
                <button
                  key={p.value}
                  className={
                    'rounded-md border px-2 py-1 text-xs ' +
                    (style.positionX === p.value
                      ? 'border-zinc-300 bg-zinc-800 text-zinc-100'
                      : 'border-border text-zinc-400 hover:bg-zinc-900')
                  }
                  onClick={() => setStyleHist({ positionX: p.value })}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          {style.positionX === 'custom' && (
            <Field label={`自訂 X ${Math.round(style.customX * 100)}%`}>
              <input
                type="range"
                min={0.05}
                max={0.95}
                step={0.01}
                className="w-full accent-zinc-300"
                value={style.customX}
                onPointerDown={onSliderDown}
                onChange={(e) => setStyle({ customX: parseFloat(e.target.value) })}
              />
            </Field>
          )}

          <Field label={`角度 ${Math.round(style.rotation)}°`}>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              className="w-full accent-zinc-300"
              value={style.rotation}
              onPointerDown={onSliderDown}
              onChange={(e) => setTrack({ rotation: parseFloat(e.target.value) })}
            />
          </Field>
        </div>
      )}
    </Section>
  )
}
