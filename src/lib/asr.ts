import type { AsrWord } from './alignment'

export type ASRStage =
  | { kind: 'loading-model'; progress: number }
  | { kind: 'transcribing'; progress: number }
  | { kind: 'done' }

export interface RunASROptions {
  language?: string
  onStage?: (s: ASRStage) => void
  signal?: AbortSignal
  granularity?: 'word' | 'segment'
}

interface RawChunk {
  timestamp: [number | null, number | null]
  text: string
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
): Promise<AsrWord[]> {
  const { onStage = () => {}, signal, language = 'zh', granularity = 'word' } = opts
  const transcriber = (await loadPipeline(onStage, signal)) as (
    input: Float32Array,
    opts: unknown,
  ) => Promise<{ chunks?: RawChunk[]; text?: string }>

  if (signal?.aborted) throw new Error('已取消')
  onStage({ kind: 'transcribing', progress: 0 })

  const result = await transcriber(pcm16k, {
    return_timestamps: granularity === 'word' ? 'word' : true,
    chunk_length_s: 30,
    stride_length_s: 5,
    language,
    task: 'transcribe',
  })

  onStage({ kind: 'done' })
  return normalizeWords(result.chunks ?? [], pcm16k.length / 16000)
}

function normalizeWords(raw: RawChunk[], totalDuration: number): AsrWord[] {
  const out: AsrWord[] = []
  let prevEnd = 0
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    const text = c.text.trim()
    if (text.length === 0) continue
    const rawStart = c.timestamp[0]
    const rawEnd = c.timestamp[1]
    let start = typeof rawStart === 'number' ? rawStart : prevEnd
    let end: number
    if (typeof rawEnd === 'number') {
      end = rawEnd
    } else {
      let nextStart: number | null = null
      for (let j = i + 1; j < raw.length; j++) {
        const ns = raw[j].timestamp[0]
        if (typeof ns === 'number') {
          nextStart = ns
          break
        }
      }
      end = nextStart ?? totalDuration
    }
    if (end <= start) end = start + 0.05
    out.push({ start, end, text })
    prevEnd = end
  }
  return out
}
