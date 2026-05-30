import { useRef, useState } from 'react'
import { Download, X } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { exportVideo, type ExportStage } from '@/lib/export'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

const STAGE_LABEL: Record<ExportStage, string> = {
  demux: '讀取影片',
  encode: '重編碼影格',
  finalize: '組裝 MP4',
}

export function ExportButton() {
  const videoBlob = useEditor((s) => s.videoBlob)
  const videoMeta = useEditor((s) => s.videoMeta)
  const tracks = useEditor((s) => s.tracks)
  const watermark = useEditor((s) => s.watermark)

  const [open, setOpen] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState<ExportStage>('demux')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const startTimeRef = useRef<number>(0)
  const [elapsed, setElapsed] = useState(0)

  async function start() {
    if (!videoBlob || !videoMeta) return
    setOpen(true)
    setProgress(0)
    setStage('demux')
    setError(null)
    setDone(false)
    setElapsed(0)
    const ac = new AbortController()
    abortRef.current = ac
    startTimeRef.current = performance.now()
    const interval = setInterval(() => {
      setElapsed((performance.now() - startTimeRef.current) / 1000)
    }, 500)
    try {
      const blob = await exportVideo({
        blob: videoBlob,
        tracks,
        watermark,
        signal: ac.signal,
        onProgress: (p, s) => {
          setProgress(p)
          setStage(s)
        },
      })
      if (ac.signal.aborted) return
      const base = videoMeta.name.replace(/\.[^.]+$/, '')
      downloadBlob(blob, `${base}-subtitled.mp4`)
      setDone(true)
    } catch (e) {
      if (ac.signal.aborted) return
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      clearInterval(interval)
      abortRef.current = null
    }
  }

  function cancel() {
    abortRef.current?.abort()
    setOpen(false)
  }

  function close() {
    if (abortRef.current) return
    setOpen(false)
  }

  const hasCues = tracks.some((t) => t.cues.length > 0)
  const disabled = !videoBlob || (!hasCues && !watermark.imageDataUrl)

  return (
    <>
      <button
        className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
        onClick={start}
        disabled={disabled || open}
      >
        <Download className="h-4 w-4" />
        匯出 MP4
      </button>
      {disabled && (
        <p className="mt-2 text-[10px] text-zinc-500">
          需要先有字幕或浮水印
        </p>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-border bg-zinc-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-base font-semibold">
                {error ? '匯出失敗' : done ? '匯出完成' : '匯出中…'}
              </h3>
              <button
                className="rounded p-1 text-zinc-500 hover:bg-zinc-800 disabled:opacity-30"
                onClick={close}
                disabled={!error && !done && !!abortRef.current}
                aria-label="關閉"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {!error && (
              <>
                <div className="mb-2 flex justify-between text-xs text-zinc-400">
                  <span>{STAGE_LABEL[stage]}</span>
                  <span className="font-mono">{Math.round(progress * 100)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full bg-emerald-500 transition-[width] duration-200"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  已耗時 {elapsed.toFixed(1)} 秒
                </p>
                {done ? (
                  <p className="mt-3 text-sm text-emerald-400">
                    已開始下載
                  </p>
                ) : (
                  <button
                    className="mt-4 w-full rounded-md border border-border px-3 py-2 text-xs hover:bg-zinc-800"
                    onClick={cancel}
                  >
                    取消
                  </button>
                )}
              </>
            )}
            {error && (
              <>
                <p className="text-sm text-red-400">{error}</p>
                <button
                  className="mt-4 w-full rounded-md border border-border px-3 py-2 text-xs hover:bg-zinc-800"
                  onClick={() => setOpen(false)}
                >
                  關閉
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
