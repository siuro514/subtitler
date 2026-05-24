import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { parseSubtitles } from '@/lib/srt'
import { Section } from './ui/Field'

export function SubtitleImporter() {
  const setSubtitles = useEditor((s) => s.setSubtitles)
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)

  async function handleFile(file: File) {
    setStatus(null)
    try {
      const text = await file.text()
      const cues = parseSubtitles(text)
      if (cues.length === 0) {
        setStatus('沒有解析到字幕')
        return
      }
      setSubtitles(cues)
      setStatus(`已載入 ${cues.length} 條字幕`)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '解析失敗')
    }
  }

  return (
    <Section title="字幕匯入">
      <button
        className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4" />
        匯入 SRT / VTT
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".srt,.vtt,text/plain"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
          e.target.value = ''
        }}
      />
      {status && <p className="text-xs text-zinc-400">{status}</p>}
    </Section>
  )
}
