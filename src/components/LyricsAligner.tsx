import { useRef, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { extractPcm16kMono } from '@/lib/audio'
import { runASR } from '@/lib/asr'
import { alignLyricsByContent } from '@/lib/alignment'
import { Field, Section } from './ui/Field'

type Stage = 'extract' | 'load-model' | 'asr' | 'align' | 'done'

const STAGE_LABEL: Record<Stage, string> = {
  extract: '抽取音訊',
  'load-model': '載入 Whisper 模型',
  asr: '辨識中…',
  align: '對齊歌詞',
  done: '完成',
}

const LANGS = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
]

export function LyricsAligner() {
  const videoBlob = useEditor((s) => s.videoBlob)
  const videoMeta = useEditor((s) => s.videoMeta)
  const setSubtitles = useEditor((s) => s.setSubtitles)
  const [lyrics, setLyrics] = useState('')
  const [lang, setLang] = useState('zh')
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
        onProgress: (p) => setProgress(p * 0.2),
      })
      if (ac.signal.aborted) return

      setStage('load-model')
      const words = await runASR(pcm, {
        language: lang,
        granularity: 'word',
        signal: ac.signal,
        onStage: (s) => {
          if (s.kind === 'loading-model') {
            setStage('load-model')
            setProgress(0.2 + s.progress * 0.3)
          } else if (s.kind === 'transcribing') {
            setStage('asr')
            setProgress(0.5 + s.progress * 0.4)
          }
        },
      })
      if (ac.signal.aborted) return

      setStage('align')
      setProgress(0.95)
      const totalDuration = videoMeta?.duration ?? pcm.length / 16000
      const { subtitles, debug } = alignLyricsByContent(
        lyricLines,
        words,
        totalDuration,
      )
      setSubtitles(subtitles)

      setStage('done')
      setProgress(1)
      const matchedLines = lyricLines.length - debug.unmappedLineCount
      const matchRatio = debug.lyricCharCount
        ? Math.round((debug.matchedChars / debug.lyricCharCount) * 100)
        : 0
      const parts: string[] = []
      parts.push(
        `Whisper 抽出 ${words.length} 個 token / ${debug.asrCharCount} 字；歌詞 ${lyricLines.length} 行 / ${debug.lyricCharCount} 字`,
      )
      parts.push(
        `字級對齊：${debug.matchedChars} / ${debug.lyricCharCount} 字命中（${matchRatio}%）`,
      )
      parts.push(
        `行級結果：${matchedLines} 行從 Whisper 抓到時間，${debug.unmappedLineCount} 行用前後內插`,
      )
      if (words.length > 0) {
        parts.push('\nWhisper 原始 token（前 40 個）：')
        const lines = words.slice(0, 40).map((w, i) => {
          const start = w.start.toFixed(2).padStart(6)
          const end = w.end.toFixed(2).padStart(6)
          const t = w.text.length > 18 ? w.text.slice(0, 18) + '…' : w.text
          return `${String(i + 1).padStart(3)}. ${start}s–${end}s  ${t}`
        })
        parts.push(lines.join('\n'))
        if (words.length > 40) parts.push(`…（共 ${words.length} 個 token）`)
      }
      setInfo(parts.join('\n'))
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
      <Field label="語言">
        <select
          className="w-full rounded-md border border-border bg-zinc-900 px-2 py-1.5 text-sm"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
        >
          {LANGS.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </Field>
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
