import { useRef, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { extractPcm16kMono } from '@/lib/audio'
import { Field, Section } from './ui/Field'

type Stage = 'extract' | 'load-model' | 'asr' | 'align' | 'done'

const STAGE_LABEL: Record<Stage, string> = {
  extract: '抽取音訊',
  'load-model': '載入 Whisper 模型',
  asr: '辨識中…',
  align: '對齊歌詞',
  done: '完成',
}

export function LyricsAligner() {
  const videoBlob = useEditor((s) => s.videoBlob)
  const [lyrics, setLyrics] = useState('')
  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState<Stage>('extract')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const lyricLines = lyrics
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  async function start() {
    if (!videoBlob || lyricLines.length === 0) return
    setOpen(true)
    setError(null)
    setInfo(null)
    setStage('extract')
    setProgress(0)
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const pcm = await extractPcm16kMono(videoBlob, {
        signal: ac.signal,
        onProgress: (p) => setProgress(p * 0.3),
      })
      if (ac.signal.aborted) return
      setStage('load-model')
      setProgress(0.3)
      setInfo(
        `已抽出 ${pcm.length.toLocaleString()} 取樣（16kHz）≈ ${(pcm.length / 16000).toFixed(1)} 秒\n歌詞行數：${lyricLines.length}\n\nPhase 2 (Whisper) 還沒接，目前到此停止。`,
      )
      setStage('done')
      setProgress(1)
    } catch (e) {
      if (ac.signal.aborted) return
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      abortRef.current = null
    }
  }

  function cancel() {
    abortRef.current?.abort()
    setOpen(false)
  }

  return (
    <Section title="用 AI 對齊歌詞">
      <Field label="歌詞（每行一句）">
        <textarea
          className="min-h-32 w-full rounded-md border border-border bg-zinc-900 px-2 py-1.5 font-mono text-xs"
          rows={6}
          placeholder="貼上歌詞，每行一句"
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
        />
      </Field>
      <button
        className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        onClick={start}
        disabled={!videoBlob || lyricLines.length === 0 || open}
      >
        <Sparkles className="h-4 w-4" />
        對齊（{lyricLines.length} 行）
      </button>
      <p className="text-[10px] text-zinc-500">
        首次使用會下載 Whisper 模型（~75MB），之後 cache。
      </p>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-border bg-zinc-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-base font-semibold">
                {error ? '對齊失敗' : stage === 'done' ? '完成' : '對齊中…'}
              </h3>
              <button
                className="rounded p-1 text-zinc-500 hover:bg-zinc-800 disabled:opacity-30"
                onClick={() => {
                  if (!error && stage !== 'done' && abortRef.current) return
                  setOpen(false)
                }}
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
                    className="h-full bg-zinc-100 transition-[width] duration-200"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                {info && (
                  <pre className="mt-3 whitespace-pre-wrap rounded border border-border bg-zinc-950 p-2 text-xs text-zinc-400">
                    {info}
                  </pre>
                )}
                {stage !== 'done' && abortRef.current && (
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
    </Section>
  )
}
