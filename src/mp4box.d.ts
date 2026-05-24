declare module 'mp4box' {
  export interface MP4Sample {
    data: Uint8Array
    size: number
    dts: number
    cts: number
    duration: number
    is_sync: boolean
    timescale: number
  }

  export interface MP4TrackInfo {
    id: number
    type: 'video' | 'audio' | string
    codec: string
    timescale: number
    duration: number
    nb_samples: number
    video?: { width: number; height: number }
    audio?: { sample_rate: number; channel_count: number; sample_size: number }
  }

  export interface MP4Info {
    duration: number
    timescale: number
    isFragmented: boolean
    tracks: MP4TrackInfo[]
    videoTracks: MP4TrackInfo[]
    audioTracks: MP4TrackInfo[]
  }

  export interface MP4File {
    onReady?: (info: MP4Info) => void
    onError?: (e: string) => void
    onSamples?: (id: number, user: unknown, samples: MP4Sample[]) => void
    appendBuffer(buffer: ArrayBuffer & { fileStart: number }): number
    flush(): void
    start(): void
    stop(): void
    setExtractionOptions(id: number, user: unknown, options: { nbSamples?: number; rapAlignement?: boolean }): void
    getTrackById(id: number): unknown
  }

  export interface DataStreamLike {
    buffer: ArrayBuffer
    endianness: number
  }

  export const DataStream: {
    new (
      buffer?: ArrayBuffer | number,
      byteOffset?: number,
      endianness?: number,
    ): DataStreamLike & {
      adjustUint32(position: number, value: number): void
    }
    BIG_ENDIAN: number
    LITTLE_ENDIAN: number
  }

  export function createFile(): MP4File
}
