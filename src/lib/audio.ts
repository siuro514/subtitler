import { demuxMp4 } from './demux'

export interface ExtractOptions {
  signal?: AbortSignal
  onProgress?: (p: number) => void
}

export async function extractPcm16kMono(
  blob: Blob,
  opts: ExtractOptions = {},
): Promise<Float32Array> {
  const { signal, onProgress } = opts
  if (signal?.aborted) throw new Error('已取消')

  onProgress?.(0)
  const demux = await demuxMp4(blob)
  if (!demux.audioCodec || demux.audioSamples.length === 0) {
    throw new Error('影片內沒有音訊軌')
  }
  onProgress?.(0.15)

  if (!('AudioDecoder' in window)) {
    throw new Error('瀏覽器不支援 AudioDecoder')
  }

  const audioChunks: AudioData[] = []
  let decoderError: Error | null = null
  const decoder = new AudioDecoder({
    output: (data) => audioChunks.push(data),
    error: (e) => {
      decoderError = e instanceof Error ? e : new Error(String(e))
    },
  })
  const decoderConfig: AudioDecoderConfig = {
    codec: demux.audioCodec,
    sampleRate: demux.audioSampleRate,
    numberOfChannels: demux.audioChannels,
    description: demux.audioDescription,
  }
  const support = await AudioDecoder.isConfigSupported(decoderConfig)
  if (!support.supported) {
    throw new Error(`瀏覽器不支援解碼 ${demux.audioCodec}`)
  }
  decoder.configure(decoderConfig)

  for (let i = 0; i < demux.audioSamples.length; i++) {
    if (signal?.aborted) {
      decoder.close()
      throw new Error('已取消')
    }
    const sample = demux.audioSamples[i]
    const chunk = new EncodedAudioChunk({
      type: sample.is_sync ? 'key' : 'delta',
      timestamp: (sample.cts * 1_000_000) / sample.timescale,
      duration: (sample.duration * 1_000_000) / sample.timescale,
      data: sample.data,
    })
    decoder.decode(chunk)
    while (decoder.decodeQueueSize > 32) {
      if (signal?.aborted || decoderError) break
      await new Promise((r) => setTimeout(r, 4))
    }
    if (decoderError) break
    if (i % 50 === 0) onProgress?.(0.15 + (i / demux.audioSamples.length) * 0.45)
  }
  await decoder.flush()
  decoder.close()
  if (decoderError) throw decoderError
  onProgress?.(0.6)

  let totalFrames = 0
  for (const d of audioChunks) totalFrames += d.numberOfFrames
  if (totalFrames === 0) throw new Error('沒有可用的音訊資料')

  const channels = demux.audioChannels
  const monoSrc = new Float32Array(totalFrames)
  let offset = 0
  const planeBuf = new Float32Array(audioChunks[0]?.numberOfFrames ?? 1024)
  for (const data of audioChunks) {
    const numFrames = data.numberOfFrames
    const buf = numFrames > planeBuf.length ? new Float32Array(numFrames) : planeBuf.subarray(0, numFrames)
    if (channels === 1) {
      data.copyTo(buf, { planeIndex: 0, format: 'f32-planar' })
      monoSrc.set(buf.subarray(0, numFrames), offset)
    } else {
      const sumBuf = new Float32Array(numFrames)
      for (let c = 0; c < channels; c++) {
        const ch = numFrames > planeBuf.length ? new Float32Array(numFrames) : planeBuf.subarray(0, numFrames)
        data.copyTo(ch, { planeIndex: c, format: 'f32-planar' })
        for (let i = 0; i < numFrames; i++) sumBuf[i] += ch[i]
      }
      for (let i = 0; i < numFrames; i++) sumBuf[i] /= channels
      monoSrc.set(sumBuf, offset)
    }
    offset += numFrames
    data.close()
  }
  onProgress?.(0.8)

  const fromRate = demux.audioSampleRate
  if (fromRate === 16000) {
    onProgress?.(1)
    return monoSrc
  }
  const out = await resampleTo16k(monoSrc, fromRate)
  onProgress?.(1)
  return out
}

async function resampleTo16k(input: Float32Array, fromRate: number): Promise<Float32Array> {
  const toRate = 16000
  const outLen = Math.ceil((input.length * toRate) / fromRate)
  const ctx = new OfflineAudioContext(1, outLen, toRate)
  const buffer = ctx.createBuffer(1, input.length, fromRate)
  buffer.copyToChannel(input as unknown as Float32Array<ArrayBuffer>, 0)
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.connect(ctx.destination)
  src.start()
  const result = await ctx.startRendering()
  return result.getChannelData(0)
}
