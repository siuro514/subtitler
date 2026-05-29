import { Bold, Italic, Plus, Strikethrough, Trash2, Underline } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { Field, Section } from './ui/Field'
import { BUNDLED_FONTS, SYSTEM_FONTS, WEB_FONTS } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import type { TextLabel } from '@/types'

export function LabelsPanel() {
  const labels = useEditor((s) => s.labels)
  const selectedId = useEditor((s) => s.selectedLabelId)
  const addLabel = useEditor((s) => s.addLabel)
  const updateLabel = useEditor((s) => s.updateLabel)
  const removeLabel = useEditor((s) => s.removeLabel)
  const selectLabel = useEditor((s) => s.selectLabel)
  const pushHistory = useEditor((s) => s.pushHistory)
  const customFonts = useEditor((s) => s.customFonts)

  const sel = labels.find((l) => l.id === selectedId) ?? null

  // Discrete edits (toggles, colors, font) get their own undo entry; the text
  // field and slider drags update live and snapshot once on interaction start.
  const patchHist = (patch: Partial<TextLabel>) => {
    if (!sel) return
    pushHistory()
    updateLabel(sel.id, patch)
  }
  const patchLive = (patch: Partial<TextLabel>) => {
    if (sel) updateLabel(sel.id, patch)
  }

  return (
    <Section title="文字標籤">
      <button
        className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
        onClick={() => addLabel()}
      >
        <Plus className="h-4 w-4" />
        新增文字標籤
      </button>

      {labels.length === 0 ? (
        <p className="text-[10px] text-zinc-500">在影片任意位置加文字，可直接在預覽上拖曳移動。</p>
      ) : (
        <ul className="space-y-1">
          {labels.map((l) => (
            <li key={l.id}>
              <div
                className={cn(
                  'flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm',
                  l.id === selectedId
                    ? 'border-sky-500/60 bg-sky-500/10'
                    : 'border-border hover:bg-zinc-900',
                )}
              >
                <button
                  className="min-w-0 flex-1 truncate text-left"
                  onClick={() => selectLabel(l.id)}
                  title={l.text}
                >
                  {l.text.trim() || <span className="text-zinc-500">（空白）</span>}
                </button>
                <button
                  className="shrink-0 text-zinc-500 hover:text-red-400"
                  onClick={() => removeLabel(l.id)}
                  aria-label="刪除標籤"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {sel && (
        <div className="space-y-3 rounded-md border border-border p-3">
          <Field label="文字">
            <textarea
              className="w-full resize-y rounded-md border border-border bg-zinc-900 px-2 py-1.5 text-sm"
              rows={2}
              value={sel.text}
              onChange={(e) => patchLive({ text: e.target.value })}
              placeholder="輸入標籤文字（可換行）"
            />
          </Field>

          <Field label="字型">
            <select
              className="w-full rounded-md border border-border bg-zinc-900 px-2 py-1.5 text-sm"
              value={sel.fontFamily}
              onChange={(e) => patchHist({ fontFamily: e.target.value })}
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
                  onClick={() => patchHist({ [key]: !sel[key] } as Partial<TextLabel>)}
                  className={cn(
                    'flex h-8 items-center justify-center rounded-md border text-xs',
                    sel[key]
                      ? 'border-zinc-300 bg-zinc-700 text-zinc-100'
                      : 'border-border text-zinc-400 hover:bg-zinc-900',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </Field>

          <Field label={`字級 ${sel.fontSize}`}>
            <input
              type="range"
              min={16}
              max={120}
              step={1}
              className="w-full accent-zinc-300"
              value={sel.fontSize}
              onPointerDown={() => pushHistory()}
              onChange={(e) => patchLive({ fontSize: parseInt(e.target.value, 10) })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="主色">
              <input
                type="color"
                className="h-8 w-full rounded border border-border bg-zinc-900"
                value={sel.color}
                onChange={(e) => patchHist({ color: e.target.value })}
              />
            </Field>
            <Field label="描邊色">
              <input
                type="color"
                className="h-8 w-full rounded border border-border bg-zinc-900"
                value={sel.strokeColor}
                onChange={(e) => patchHist({ strokeColor: e.target.value })}
              />
            </Field>
          </div>

          <Field label={`描邊寬度 ${sel.strokeWidth}`}>
            <input
              type="range"
              min={0}
              max={20}
              step={0.5}
              className="w-full accent-zinc-300"
              value={sel.strokeWidth}
              onPointerDown={() => pushHistory()}
              onChange={(e) => patchLive({ strokeWidth: parseFloat(e.target.value) })}
            />
          </Field>

          <div className="space-y-2 rounded-md border border-border p-2">
            <label className="flex items-center justify-between text-xs font-medium text-zinc-300">
              <span>背景框</span>
              <input
                type="checkbox"
                checked={sel.background}
                onChange={(e) => patchHist({ background: e.target.checked })}
              />
            </label>
            {sel.background && (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="顏色">
                    <input
                      type="color"
                      className="h-8 w-full rounded border border-border bg-zinc-900"
                      value={sel.backgroundColor}
                      onChange={(e) => patchHist({ backgroundColor: e.target.value })}
                    />
                  </Field>
                  <Field label={`不透明 ${Math.round(sel.backgroundOpacity * 100)}%`}>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      className="w-full accent-zinc-300"
                      value={sel.backgroundOpacity}
                      onPointerDown={() => pushHistory()}
                      onChange={(e) => patchLive({ backgroundOpacity: parseFloat(e.target.value) })}
                    />
                  </Field>
                </div>
                <Field label={`圓角 ${Math.round(sel.backgroundRadius * 100)}%`}>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    className="w-full accent-zinc-300"
                    value={sel.backgroundRadius}
                    onPointerDown={() => pushHistory()}
                    onChange={(e) => patchLive({ backgroundRadius: parseFloat(e.target.value) })}
                  />
                </Field>
              </div>
            )}
          </div>
        </div>
      )}
    </Section>
  )
}
