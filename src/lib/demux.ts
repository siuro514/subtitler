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
    let expectedVideo = 0
    let expectedAudio = 0
    let videoDescription: Uint8Array | undefined
    let audioDescription: Uint8Array | undefined

    file.onError = (e) => reject(new Error('MP4 demux error: ' + e))

    file.onReady = (info) => {
      if (info.videoTracks.length === 0) {
        reject(new Error('影片裡沒有 video track'))
        return
      }
      videoTrack = info.videoTracks[0]
      audioTrack = info.audioTracks[0] ?? null
      expectedVideo = videoTrack.nb_samples
      expectedAudio = audioTrack?.nb_samples ?? 0

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
        reject(err instanceof Error ? err : new Error(String(err)))
        return
      }

      file.setExtractionOptions(videoTrack.id, null, { nbSamples: 200 })
      if (audioTrack) {
        file.setExtractionOptions(audioTrack.id, null, { nbSamples: 200 })
      }
      file.start()
    }

    file.onSamples = (id, _user, samples) => {
      if (videoTrack && id === videoTrack.id) {
        videoSamples.push(...samples)
      } else if (audioTrack && id === audioTrack.id) {
        audioSamples.push(...samples)
      }
      const vDone = videoTrack ? videoSamples.length >= expectedVideo : true
      const aDone = audioTrack ? audioSamples.length >= expectedAudio : true
      if (vDone && aDone && videoTrack) {
        const duration = videoTrack.duration / videoTrack.timescale
        resolve({
          width: videoTrack.video?.width ?? 0,
          height: videoTrack.video?.height ?? 0,
          duration,
          videoCodec: videoTrack.codec,
          videoDescription,
          videoTimescale: videoTrack.timescale,
          videoSamples,
          audioCodec: audioTrack?.codec ?? null,
          audioDescription,
          audioTimescale: audioTrack?.timescale ?? 0,
          audioSampleRate: audioTrack?.audio?.sample_rate ?? 0,
          audioChannels: audioTrack?.audio?.channel_count ?? 0,
          audioSamples,
        })
      }
    }

    const ab = buffer as ArrayBuffer & { fileStart: number }
    ab.fileStart = 0
    file.appendBuffer(ab)
    file.flush()
  })
}
