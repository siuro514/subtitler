import { FileText } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { serializeSrt } from '@/lib/srt'

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function SrtExportButton() {
  const tracks = useEditor((s) => s.tracks)
  const activeTrackId = useEditor((s) => s.activeTrackId)
  const meta = useEditor((s) => s.videoMeta)
  const active = tracks.find((t) => t.id === activeTrackId) ?? null
  const cues = active?.cues ?? []
  const disabled = cues.length === 0

  function exportSrt() {
    if (disabled) return
    const base = (meta?.name ?? 'subtitles').replace(/\.[^.]+$/, '')
    downloadText(serializeSrt(cues), `${base}.srt`)
  }

  return (
    <button
      className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
      onClick={exportSrt}
      disabled={disabled}
    >
      <FileText className="h-4 w-4" />
      匯出 SRT
    </button>
  )
}
