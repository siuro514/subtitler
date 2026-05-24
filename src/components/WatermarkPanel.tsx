import { useRef } from 'react'
import { Upload, X } from 'lucide-react'
import { useEditor } from '@/store/editor'
import type { Watermark } from '@/types'
import { Field, Section } from './ui/Field'

const POSITION_GRID: Watermark['position'][] = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
]

export function WatermarkPanel() {
  const watermark = useEditor((s) => s.watermark)
  const setWatermark = useEditor((s) => s.setWatermark)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      alert('圖片過大（>10MB）')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setWatermark({ imageDataUrl: String(reader.result) })
    reader.readAsDataURL(file)
  }

  return (
    <Section title="浮水印">
      {watermark.imageDataUrl ? (
        <div className="space-y-3">
          <div className="relative rounded-md border border-border bg-zinc-950 p-2">
            <img
              src={watermark.imageDataUrl}
              alt="watermark"
              className="mx-auto max-h-24 max-w-full object-contain"
            />
            <button
              className="absolute right-1 top-1 rounded-full bg-zinc-900/80 p-1 text-zinc-400 hover:text-zinc-100"
              onClick={() => setWatermark({ imageDataUrl: null })}
              aria-label="移除"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <Field label={`尺寸 ${Math.round(watermark.width * 100)}% (相對影片寬)`}>
            <input
              type="range"
              min={0.05}
              max={0.6}
              step={0.01}
              className="w-full accent-zinc-300"
              value={watermark.width}
              onChange={(e) => setWatermark({ width: parseFloat(e.target.value) })}
            />
          </Field>

          <Field label={`透明度 ${Math.round(watermark.opacity * 100)}%`}>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.01}
              className="w-full accent-zinc-300"
              value={watermark.opacity}
              onChange={(e) => setWatermark({ opacity: parseFloat(e.target.value) })}
            />
          </Field>

          <Field label="位置">
            <div className="grid grid-cols-3 gap-1">
              {POSITION_GRID.map((pos) => (
                <button
                  key={pos}
                  aria-label={pos}
                  className={
                    'flex h-8 items-center justify-center rounded border text-xs ' +
                    (watermark.position === pos
                      ? 'border-zinc-300 bg-zinc-800'
                      : 'border-border text-zinc-500 hover:bg-zinc-900')
                  }
                  onClick={() => setWatermark({ position: pos })}
                >
                  <span
                    className={
                      'block h-1.5 w-1.5 rounded-sm ' +
                      (watermark.position === pos ? 'bg-zinc-100' : 'bg-zinc-600')
                    }
                  />
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label={`邊距 X ${Math.round(watermark.marginX * 100)}%`}>
              <input
                type="range"
                min={0}
                max={0.2}
                step={0.01}
                className="w-full accent-zinc-300"
                value={watermark.marginX}
                onChange={(e) => setWatermark({ marginX: parseFloat(e.target.value) })}
              />
            </Field>
            <Field label={`邊距 Y ${Math.round(watermark.marginY * 100)}%`}>
              <input
                type="range"
                min={0}
                max={0.2}
                step={0.01}
                className="w-full accent-zinc-300"
                value={watermark.marginY}
                onChange={(e) => setWatermark({ marginY: parseFloat(e.target.value) })}
              />
            </Field>
          </div>
        </div>
      ) : (
        <button
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          上傳圖片
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
    </Section>
  )
}
