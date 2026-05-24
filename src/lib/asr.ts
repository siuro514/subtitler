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

export function alignLyricsToChunks(
  lyrics: string[],
  chunks: ASRChunk[],
  totalDuration: number,
): Subtitle[] {
  if (lyrics.length === 0) return []
  if (chunks.length === 0) {
    const per = totalDuration / lyrics.length
    return lyrics.map((text, i) => ({
      id: uid(),
      start: per * i,
      end: per * (i + 1),
      text,
    }))
  }

  if (lyrics.length === chunks.length) {
    return lyrics.map((text, i) => {
      const [start, end] = chunks[i].timestamp
      return {
        id: uid(),
        start: start ?? 0,
        end: end ?? (chunks[i + 1]?.timestamp[0] ?? totalDuration),
        text,
      }
    })
  }

  const firstStart = chunks[0].timestamp[0] ?? 0
  const lastEnd =
    chunks[chunks.length - 1].timestamp[1] ??
    chunks[chunks.length - 1].timestamp[0] ??
    totalDuration
  const span = Math.max(0.1, lastEnd - firstStart)
  const per = span / lyrics.length
  return lyrics.map((text, i) => ({
    id: uid(),
    start: firstStart + per * i,
    end: firstStart + per * (i + 1),
    text,
  }))
}
