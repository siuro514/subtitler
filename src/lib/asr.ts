import type { Subtitle } from '@/types'
import { uid } from './utils'

export interface ASRChunk {
  timestamp: [number, number | null]
  text: string
}

export type ASRStage =
  | { kind: 'loading-model'; progress: number }
  | { kind: 'transcribing'; progress: number }
  | { kind: 'done' }

export interface RunASROptions {
  language?: string
  onStage?: (s: ASRStage) => void
  signal?: AbortSignal
}

let pipelinePromise: Promise<unknown> | null = null
let cachedAudioPipeline: unknown = null

async function loadPipeline(
  onStage: (s: ASRStage) => void,
  signal?: AbortSignal,
): Promise<unknown> {
  if (cachedAudioPipeline) return cachedAudioPipeline
  if (pipelinePromise) return pipelinePromise

  onStage({ kind: 'loading-model', progress: 0 })
  pipelinePromise = (async () => {
    const tx = await import('@huggingface/transformers')
    if (signal?.aborted) throw new Error('已取消')
    const hasWebGPU =
      typeof navigator !== 'undefined' &&
      'gpu' in navigator &&
      !!(navigator as Navigator & { gpu?: unknown }).gpu
    const opts: Record<string, unknown> = {
      dtype: 'q8',
      progress_callback: (item: { progress?: number }) => {
        const prog = typeof item.progress === 'number' ? item.progress / 100 : 0
        onStage({ kind: 'loading-model', progress: prog })
      },
    }
    if (hasWebGPU) opts.device = 'webgpu'
    const p = await tx.pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-base',
      opts as Parameters<typeof tx.pipeline>[2],
    )
    cachedAudioPipeline = p
    return p
  })().catch((e) => {
    pipelinePromise = null
    throw e
  })
  return pipelinePromise
}

export async function runASR(
  pcm16k: Float32Array,
  opts: RunASROptions,
): Promise<ASRChunk[]> {
  const { onStage = () => {}, signal, language = 'zh' } = opts
  const transcriber = (await loadPipeline(onStage, signal)) as (
    input: Float32Array,
    opts: unknown,
  ) => Promise<{ chunks?: ASRChunk[]; text?: string }>

  if (signal?.aborted) throw new Error('已取消')
  onStage({ kind: 'transcribing', progress: 0 })

  const result = await transcriber(pcm16k, {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
    language,
    task: 'transcribe',
  })

  onStage({ kind: 'done' })
  return result.chunks ?? []
}

export interface AlignmentResult {
  subtitles: Subtitle[]
  matched: number
  spreadCount: number
  normalizedChunks: { start: number; end: number; text: string }[]
}

function normalizeChunks(chunks: ASRChunk[], totalDuration: number) {
  const out: { start: number; end: number; text: string }[] = []
  let prevEnd = 0
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i]
    const rawStart = c.timestamp[0]
    const rawEnd = c.timestamp[1]
    let start = typeof rawStart === 'number' ? rawStart : prevEnd
    if (typeof rawEnd === 'number') {
      out.push({ start, end: rawEnd, text: c.text.trim() })
      prevEnd = rawEnd
      continue
    }
    let nextStart: number | null = null
    for (let j = i + 1; j < chunks.length; j++) {
      const ns = chunks[j].timestamp[0]
      if (typeof ns === 'number') {
        nextStart = ns
        break
      }
    }
    const end = nextStart ?? totalDuration
    out.push({ start, end, text: c.text.trim() })
    prevEnd = end
  }
  return out.filter((c) => c.text.length > 0)
}

export function alignLyricsToChunks(
  lyrics: string[],
  chunks: ASRChunk[],
  totalDuration: number,
): AlignmentResult {
  if (lyrics.length === 0)
    return { subtitles: [], matched: 0, spreadCount: 0, normalizedChunks: [] }

  const normalized = normalizeChunks(chunks, totalDuration)

  if (normalized.length === 0) {
    const per = totalDuration / lyrics.length
    const subtitles = lyrics.map((text, i) => ({
      id: uid(),
      start: per * i,
      end: per * (i + 1),
      text,
    }))
    return { subtitles, matched: 0, spreadCount: lyrics.length, normalizedChunks: normalized }
  }

  const matched = Math.min(lyrics.length, normalized.length)
  const subtitles: Subtitle[] = []

  for (let i = 0; i < matched; i++) {
    const { start, end } = normalized[i]
    const nextStart = normalized[i + 1]?.start ?? totalDuration
    subtitles.push({
      id: uid(),
      start,
      end: Math.max(start + 0.1, end || nextStart),
      text: lyrics[i],
    })
  }

  const remaining = lyrics.slice(matched)
  if (remaining.length > 0) {
    const lastEnd = subtitles[matched - 1]?.end ?? 0
    const span = Math.max(0.1, totalDuration - lastEnd)
    const per = span / remaining.length
    for (let i = 0; i < remaining.length; i++) {
      subtitles.push({
        id: uid(),
        start: lastEnd + per * i,
        end: lastEnd + per * (i + 1),
        text: remaining[i],
      })
    }
  }

  return { subtitles, matched, spreadCount: remaining.length, normalizedChunks: normalized }
}
