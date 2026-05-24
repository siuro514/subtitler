import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import { demuxMp4 } from './demux'
import { loadWatermarkImage, renderFrame } from './render'
import type { Subtitle, SubtitleStyle, Watermark } from '@/types'

export interface ExportOptions {
  blob: Blob
  subtitles: Subtitle[]
  style: SubtitleStyle
  watermark: Watermark
  onProgress?: (p: number, stage: ExportStage) => void
  signal?: AbortSignal
}

export type ExportStage = 'demux' | 'encode' | 'finalize'

function pickVideoCodec(width: number, height: number): { codec: string; muxerCodec: 'avc' } {
  const _ = Math.max(width, height)
  if (_ > 2560) return { codec: 'avc1.640033', muxerCodec: 'avc' } // High@5.1
  if (_ > 1280) return { codec: 'avc1.640028', muxerCodec: 'avc' } // High@4.0
  return { codec: 'avc1.42E01F', muxerCodec: 'avc' } // Baseline@3.1
}

function pickBitrate(width: number, height: number): number {
  const pixels = width * height
  if (pixels >= 3840 * 2160) return 25_000_000
  if (pixels >= 1920 * 1080) return 8_000_000
  if (pixels >= 1280 * 720) return 5_000_000
  return 2_500_000
}

const VIDEO_CODECS_FALLBACK = [
  'avc1.640033',
  'avc1.640028',
  'avc1.4D0028',
  'avc1.42E01F',
]

async function pickSupportedConfig(
  width: number,
  height: number,
  bitrate: number,
  framerate: number,
): Promise<VideoEncoderConfig> {
  const preferred = pickVideoCodec(width, height).codec
  const candidates = [preferred, ...VIDEO_CODECS_FALLBACK.filter((c) => c !== preferred)]
  for (const codec of candidates) {
    const cfg: VideoEncoderConfig = {
      codec,
      width,
      height,
      bitrate,
      framerate,
      avc: { format: 'avc' },
    }
    const { supported } = await VideoEncoder.isConfigSupported(cfg)
    if (supported) return cfg
  }
  throw new Error('找不到可用的 H.264 編碼器設定')
}

function abortReason(signal?: AbortSignal): Error {
  return new Error(signal?.reason instanceof Error ? signal.reason.message : '已取消')
}

export async function exportVideo(opts: ExportOptions): Promise<Blob> {
  const { blob, subtitles, style, watermark, onProgress, signal } = opts
  if (signal?.aborted) throw abortReason(signal)

  if (!('VideoEncoder' in window)) throw new Error('瀏覽器不支援 VideoEncoder')

  onProgress?.(0, 'demux')
  const demux = await demuxMp4(blob)
  if (signal?.aborted) throw abortReason(signal)

  const decoderSupport = await VideoDecoder.isConfigSupported({
    codec: demux.videoCodec,
    codedWidth: demux.width,
    codedHeight: demux.height,
    description: demux.videoDescription,
  })
  if (!decoderSupport.supported) {
    throw new Error(`瀏覽器不支援解碼 ${demux.videoCodec}`)
  }

  const fps =
    demux.videoSamples.length > 1
      ? demux.videoSamples.length / demux.duration
      : 30
  const encoderConfig = await pickSupportedConfig(
    demux.width,
    demux.height,
    pickBitrate(demux.width, demux.height),
    Math.min(60, Math.max(15, Math.round(fps))),
  )

  const audioPlan = await planAudio(demux)

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
    video: {
      codec: 'avc',
      width: demux.width,
      height: demux.height,
    },
    audio: audioPlan
      ? {
          codec: 'aac',
          sampleRate: demux.audioSampleRate,
          numberOfChannels: demux.audioChannels,
        }
      : undefined,
  })

  const watermarkImg = await loadWatermarkImage(watermark.imageDataUrl)
  if (signal?.aborted) throw abortReason(signal)

  const offscreen = new OffscreenCanvas(demux.width, demux.height)
  const ctx = offscreen.getContext('2d')
  if (!ctx) throw new Error('OffscreenCanvas 2D context 取得失敗')

  let encoderError: Error | null = null
  let processedFrames = 0
  const totalFrames = demux.videoSamples.length

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta)
    },
    error: (e) => {
      encoderError = e instanceof Error ? e : new Error(String(e))
    },
  })
  encoder.configure(encoderConfig)

  let decoderError: Error | null = null
  const decoder = new VideoDecoder({
    output: (frame) => {
      try {
        ctx.clearRect(0, 0, demux.width, demux.height)
        ctx.drawImage(frame, 0, 0, demux.width, demux.height)
        renderFrame(
          ctx,
          {
            width: demux.width,
            height: demux.height,
            time: (frame.timestamp ?? 0) / 1_000_000,
            subtitles,
            style,
            watermark,
            watermarkImage: watermarkImg,
          },
          false,
        )
        const out = new VideoFrame(offscreen, {
          timestamp: frame.timestamp,
          duration: frame.duration ?? undefined,
        })
        frame.close()
        encoder.encode(out)
        out.close()
        processedFrames++
        if (processedFrames % 5 === 0 || processedFrames === totalFrames) {
          onProgress?.(processedFrames / totalFrames, 'encode')
        }
      } catch (e) {
        decoderError = e instanceof Error ? e : new Error(String(e))
      }
    },
    error: (e) => {
      decoderError = e instanceof Error ? e : new Error(String(e))
    },
  })
  decoder.configure({
    codec: demux.videoCodec,
    codedWidth: demux.width,
    codedHeight: demux.height,
    description: demux.videoDescription,
    optimizeForLatency: false,
  })

  for (let i = 0; i < demux.videoSamples.length; i++) {
    if (signal?.aborted) break
    const sample = demux.videoSamples[i]
    const chunk = new EncodedVideoChunk({
      type: sample.is_sync ? 'key' : 'delta',
      timestamp: (sample.cts * 1_000_000) / sample.timescale,
      duration: (sample.duration * 1_000_000) / sample.timescale,
      data: sample.data,
    })
    decoder.decode(chunk)

    while (decoder.decodeQueueSize > 32 || encoder.encodeQueueSize > 32) {
      if (signal?.aborted) break
      if (decoderError || encoderError) break
      await new Promise((r) => setTimeout(r, 4))
    }
    if (decoderError || encoderError) break
  }

  try {
    await decoder.flush()
  } catch (e) {
    if (!signal?.aborted) throw e
  }
  if (decoderError) throw decoderError

  try {
    await encoder.flush()
  } catch (e) {
    if (!signal?.aborted) throw e
  }
  if (encoderError) throw encoderError

  decoder.close()
  encoder.close()

  if (signal?.aborted) throw abortReason(signal)

  if (audioPlan?.mode === 'passthrough') {
    for (const sample of demux.audioSamples) {
      const chunk = new EncodedAudioChunk({
        type: sample.is_sync ? 'key' : 'delta',
        timestamp: (sample.cts * 1_000_000) / sample.timescale,
        duration: (sample.duration * 1_000_000) / sample.timescale,
        data: sample.data,
      })
      const meta: EncodedAudioChunkMetadata = {
        decoderConfig: {
          codec: demux.audioCodec!,
          sampleRate: demux.audioSampleRate,
          numberOfChannels: demux.audioChannels,
          description: demux.audioDescription,
        },
      }
      muxer.addAudioChunk(chunk, meta)
    }
  } else if (audioPlan?.mode === 'transcode') {
    await transcodeAudioToAAC(demux, muxer, signal)
  }

  onProgress?.(1, 'finalize')
  muxer.finalize()
  const buffer = (muxer.target as ArrayBufferTarget).buffer
  return new Blob([buffer], { type: 'video/mp4' })
}

type AudioPlan = { mode: 'passthrough' } | { mode: 'transcode' } | null

async function planAudio(demux: Awaited<ReturnType<typeof demuxMp4>>): Promise<AudioPlan> {
  if (!demux.audioCodec || demux.audioSamples.length === 0) return null
  if (demux.audioCodec.startsWith('mp4a')) return { mode: 'passthrough' }
  if (!('AudioDecoder' in window) || !('AudioEncoder' in window)) return null
  try {
    const decSup = await AudioDecoder.isConfigSupported({
      codec: demux.audioCodec,
      sampleRate: demux.audioSampleRate,
      numberOfChannels: demux.audioChannels,
      description: demux.audioDescription,
    })
    const encSup = await AudioEncoder.isConfigSupported({
      codec: 'mp4a.40.2',
      sampleRate: demux.audioSampleRate,
      numberOfChannels: demux.audioChannels,
      bitrate: 128_000,
    })
    if (decSup.supported && encSup.supported) return { mode: 'transcode' }
  } catch {
    // ignore
  }
  return null
}

async function transcodeAudioToAAC(
  demux: Awaited<ReturnType<typeof demuxMp4>>,
  muxer: Muxer<ArrayBufferTarget>,
  signal: AbortSignal | undefined,
) {
  let encErr: Error | null = null
  let decErr: Error | null = null

  const encoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => {
      encErr = e instanceof Error ? e : new Error(String(e))
    },
  })
  encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate: demux.audioSampleRate,
    numberOfChannels: demux.audioChannels,
    bitrate: 128_000,
  })

  const decoder = new AudioDecoder({
    output: (frame) => {
      try {
        encoder.encode(frame)
        frame.close()
      } catch (e) {
        decErr = e instanceof Error ? e : new Error(String(e))
      }
    },
    error: (e) => {
      decErr = e instanceof Error ? e : new Error(String(e))
    },
  })
  decoder.configure({
    codec: demux.audioCodec!,
    sampleRate: demux.audioSampleRate,
    numberOfChannels: demux.audioChannels,
    description: demux.audioDescription,
  })

  for (const sample of demux.audioSamples) {
    if (signal?.aborted) break
    const chunk = new EncodedAudioChunk({
      type: sample.is_sync ? 'key' : 'delta',
      timestamp: (sample.cts * 1_000_000) / sample.timescale,
      duration: (sample.duration * 1_000_000) / sample.timescale,
      data: sample.data,
    })
    decoder.decode(chunk)
    while (decoder.decodeQueueSize > 32 || encoder.encodeQueueSize > 32) {
      if (signal?.aborted || decErr || encErr) break
      await new Promise((r) => setTimeout(r, 4))
    }
    if (decErr || encErr) break
  }

  try {
    await decoder.flush()
  } catch (e) {
    if (!signal?.aborted) throw e
  }
  if (decErr) throw decErr
  try {
    await encoder.flush()
  } catch (e) {
    if (!signal?.aborted) throw e
  }
  if (encErr) throw encErr
  decoder.close()
  encoder.close()
}
