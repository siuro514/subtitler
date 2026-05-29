import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { parseSettings, serializeSettings } from '@/lib/settings'
import { Section } from './ui/Field'

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function SettingsIO() {
  const style = useEditor((s) => s.style)
  const watermark = useEditor((s) => s.watermark)
  const applySettings = useEditor((s) => s.applySettings)
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)

  function exportSettings() {
    downloadText(serializeSettings(style, watermark), 'subtitler-settings.json')
    setStatus('已匯出設定檔')
  }

  async function importSettings(file: File) {
    setStatus(null)
    try {
      const { style: s, watermark: w } = parseSettings(await file.text())
      applySettings({ style: s, watermark: w })
      setStatus('已套用設定（可⌘Z復原）')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '匯入失敗')
    }
  }

  return (
    <Section title="設定檔">
      <button
        className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
        onClick={exportSettings}
      >
        <Download className="h-4 w-4" />
        匯出設定
      </button>
      <button
        className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4" />
        匯入設定
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void importSettings(f)
          e.target.value = ''
        }}
      />
      <p className="text-[10px] text-zinc-500">匯出字幕樣式與浮水印設定（不含影片與字幕內容）。</p>
      {status && <p className="text-xs text-zinc-400">{status}</p>}
    </Section>
  )
}
