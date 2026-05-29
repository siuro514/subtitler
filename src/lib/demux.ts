import * as MP4Box from 'mp4box'
import type { MP4Sample, MP4TrackInfo } from 'mp4box'

export interface DemuxResult {
  width: number
  height: number
  duration: number
  videoCodec: string
  videoDescription: Uint8Array | undefined
  videoTimescale: number
  videoSamples: MP4Sample[]
  audioCodec: string | null
  audioDescription: Uint8Array | undefined
  audioTimescale: number
  audioSampleRate: number
  audioChannels: number
  audioSamples: MP4Sample[]
}

interface BoxWriter {
  write(stream: { adjustUint32(p: number, v: number): void }): void
}

interface BoxParserEntry {
  avcC?: BoxWriter
  hvcC?: BoxWriter
  vpcC?: BoxWriter
  av1C?: BoxWriter
  esds?: BoxWriter
}

interface TrackInternal {
  mdia: {
    minf: {
      stbl: {
        stsd: {
          entries: BoxParserEntry[]
        }
      }
    }
  }
}

function extractCodecDescription(track: TrackInternal): Uint8Array | undefined {
  for (const entry of track.mdia.minf.stbl.stsd.entries) {
    const box = entry.avcC ?? entry.hvcC ?? entry.vpcC ?? entry.av1C
    if (box) {
      const stream = new MP4Box.DataStream(
        new ArrayBuffer(0),
        0,
        MP4Box.DataStream.BIG_ENDIAN,
      ) as InstanceType<typeof MP4Box.DataStream> & {
        save?: (name: string, type: string) => void
        position?: number
        _byteLength?: number
      }
      ;(box as unknown as { write(s: typeof stream): void }).write(stream)
      const buf = stream.buffer
      return new Uint8Array(buf, 8)
    }
  }
  return undefined
}

interface MP4Descriptor {
  tag: number
  data?: Uint8Array
  findDescriptor(tag: number): MP4Descriptor | undefined
}

interface ESDSEntry {
  esds?: {
    esd?: MP4Descriptor
  }
}

function extractAudioDescription(track: TrackInternal): Uint8Array | undefined {
  for (const entry of track.mdia.minf.stbl.stsd.entries as ESDSEntry[]) {
    const esd = entry.esds?.esd
    if (!esd) continue
    const dcd = esd.findDescriptor(0x04)
    if (!dcd) continue
    const dsi = dcd.findDescriptor(0x05)
    if (dsi?.data && dsi.data.length > 0) {
      return new Uint8Array(dsi.data)
    }
  }
  return undefined
}

export async function demuxMp4(blob: Blob): Promise<DemuxResult> {
  const buffer = await blob.arrayBuffer()
  const file = MP4Box.createFile()

  return new Promise<DemuxResult>((resolve, reject) => {
    const videoSamples: MP4Sample[] = []
    const audioSamples: MP4Sample[] = []
    let videoTrack: MP4TrackInfo | null = null
    let audioTrack: MP4TrackInfo | null = null
    let videoDescription: Uint8Array | undefined
    let audioDescription: Uint8Array | undefined
    let ready = false
    let failed = false

    const fail = (err: Error) => {
      if (failed) return
      failed = true
      reject(err)
    }

    file.onError = (e) => fail(new Error('MP4 demux error: ' + e))

    file.onReady = (info) => {
      if (info.videoTracks.length === 0) {
        fail(new Error('影片裡沒有 video track'))
        return
      }
      videoTrack = info.videoTracks[0]
      audioTrack = info.audioTracks[0] ?? null

      try {
        videoDescription = extractCodecDescription(
          file.getTrackById(videoTrack.id) as TrackInternal,
        )
        if (audioTrack) {
          audioDescription = extractAudioDescription(
            file.getTrackById(audioTrack.id) as TrackInternal,
          )
        }
      } catch (err) {
        fail(err instanceof Error ? err : new Error(String(err)))
        return
      }

      file.setExtractionOptions(videoTrack.id, null, { nbSamples: 200 })
      if (audioTrack) {
        file.setExtractionOptions(audioTrack.id, null, { nbSamples: 200 })
      }
      ready = true
      file.start()
    }

    // mp4box delivers samples in batches during start()/flush(); just accumulate.
    file.onSamples = (id, _user, samples) => {
      if (videoTrack && id === videoTrack.id) {
        videoSamples.push(...samples)
      } else if (audioTrack && id === audioTrack.id) {
        audioSamples.push(...samples)
      }
    }

    const ab = buffer as ArrayBuffer & { fileStart: number }
    ab.fileStart = 0
    file.appendBuffer(ab)
    file.flush()

    // After flush() every sample of the appended buffer has been emitted, so
    // resolving here avoids relying on moov-reported sample counts (which are 0
    // for fragmented MP4s and would otherwise drop the audio track).
    if (failed) return
    if (!ready || !videoTrack) {
      fail(new Error('無法解析這個 MP4（缺少 moov？）'))
      return
    }
    const vt = videoTrack as MP4TrackInfo
    const at = audioTrack as MP4TrackInfo | null
    resolve({
      width: vt.video?.width ?? 0,
      height: vt.video?.height ?? 0,
      duration: vt.duration / vt.timescale,
      videoCodec: vt.codec,
      videoDescription,
      videoTimescale: vt.timescale,
      videoSamples,
      audioCodec: at && audioSamples.length > 0 ? at.codec : null,
      audioDescription,
      audioTimescale: at?.timescale ?? 0,
      audioSampleRate: at?.audio?.sample_rate ?? 0,
      audioChannels: at?.audio?.channel_count ?? 0,
      audioSamples,
    })
  })
}
