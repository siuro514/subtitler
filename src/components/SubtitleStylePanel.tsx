import { useEditor } from '@/store/editor'
import { Field, Section } from './ui/Field'

const FONT_FAMILIES = [
  { label: '系統 sans-serif', value: 'sans-serif' },
  { label: '系統 serif', value: 'serif' },
  { label: '等寬', value: 'monospace' },
  { label: 'PingFang TC', value: '"PingFang TC", "Noto Sans TC", sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
]

const POSITIONS = [
  { label: '上', value: 'top' },
  { label: '中', value: 'middle' },
  { label: '下', value: 'bottom' },
  { label: '自訂', value: 'custom' },
] as const

export function SubtitleStylePanel() {
  const style = useEditor((s) => s.style)
  const setStyle = useEditor((s) => s.setStyle)

  return (
    <Section title="字幕樣式">
      <Field label="字型">
        <select
          className="w-full rounded-md border border-border bg-zinc-900 px-2 py-1.5 text-sm"
          value={style.fontFamily}
          onChange={(e) => setStyle({ fontFamily: e.target.value })}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
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
