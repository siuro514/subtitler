import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { parseSubtitles } from '@/lib/srt'
import { Section } from './ui/Field'

// Subtitle files (especially CJK ones, and ones saved as .txt) are often not
// UTF-8. Try strict UTF-8 first, then fall back to common encodings and pick
// whichever decodes with the fewest replacement characters.
const FALLBACK_ENCODINGS = ['big5', 'gb18030', 'shift_jis', 'euc-kr']

function countReplacement(s: string): number {
  let n = 0
  for (const ch of s) if (ch === '�') n++
  return n
}

async function readSubtitleText(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    let best = ''
    let bestBad = Infinity
    for (const enc of FALLBACK_ENCODINGS) {
      try {
        const text = new TextDecoder(enc).decode(buf)
        const bad = countReplacement(text)
        if (bad < bestBad) {
          best = text
          bestBad = bad
          if (bad === 0) break
        }
      } catch {
        // encoding label unsupported in this browser; skip
      }
    }
    // Last resort: lossy UTF-8 so timestamps still parse even if text is garbled.
    return best || new TextDecoder('utf-8').decode(buf)
  }
}

export function SubtitleImporter() {
  const setActiveTrackCues = useEditor((s) => s.setActiveTrackCues)
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)

  async function handleFile(file: File) {
    setStatus(null)
    try {
      const text = await readSubtitleText(file)
      const cues = parseSubtitles(text)
      if (cues.length === 0) {
        setStatus('沒有解析到字幕')
        return
      }
      setActiveTrackCues(cues)
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
        accept=".srt,.vtt,.txt,text/plain"
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
