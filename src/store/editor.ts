import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  DEFAULT_STYLE,
  DEFAULT_WATERMARK,
  type CustomFont,
  type ProjectSnapshot,
  type Subtitle,
  type SubtitleStyle,
  type VideoMeta,
  type Watermark,
} from '@/types'
import { clamp, uid } from '@/lib/utils'
import { registerCustomFont } from '@/lib/fonts'
import { resolveOverlap } from '@/lib/overlap'

interface HistoryEntry {
  subtitles: Subtitle[]
  style: SubtitleStyle
  watermark: Watermark
  customFonts: CustomFont[]
}

const MAX_HISTORY = 50

interface EditorState {
  videoBlob: Blob | null
  videoUrl: string | null
  videoMeta: VideoMeta | null
  currentTime: number
  isPlaying: boolean
  selectedSubtitleId: string | null
  subtitles: Subtitle[]
  style: SubtitleStyle
  watermark: Watermark
  exportProgress: number | null
  hasUnsupportedBrowser: boolean
  customFonts: CustomFont[]
  past: HistoryEntry[]
  future: HistoryEntry[]

  setVideo: (blob: Blob, meta: VideoMeta) => void
  clearVideo: () => void
  setCurrentTime: (t: number) => void
  setPlaying: (p: boolean) => void
  setSubtitles: (subs: Subtitle[]) => void
  addSubtitle: (start: number, end: number, text?: string) => string
  updateSubtitle: (id: string, patch: Partial<Subtitle>) => void
  removeSubtitle: (id: string) => void
  selectSubtitle: (id: string | null) => void
  setStyle: (patch: Partial<SubtitleStyle>) => void
  setWatermark: (patch: Partial<Watermark>) => void
  applySettings: (patch: { style?: Partial<SubtitleStyle>; watermark?: Partial<Watermark> }) => void
  setExportProgress: (p: number | null) => void
  addCustomFont: (family: string, data: ArrayBuffer) => Promise<void>
  removeCustomFont: (id: string) => void
  pushHistory: () => void
  undo: () => void
  redo: () => void
  hydrate: (snap: ProjectSnapshot) => Promise<void>
  toSnapshot: () => ProjectSnapshot
}

function snapshotHistory(s: {
  subtitles: Subtitle[]
  style: SubtitleStyle
  watermark: Watermark
  customFonts: CustomFont[]
}): HistoryEntry {
  return {
    subtitles: s.subtitles,
    style: s.style,
    watermark: s.watermark,
    customFonts: s.customFonts,
  }
}

export const useEditor = create<EditorState>()(
  subscribeWithSelector((set, get) => ({
    videoBlob: null,
    videoUrl: null,
    videoMeta: null,
    currentTime: 0,
    isPlaying: false,
    selectedSubtitleId: null,
    subtitles: [],
    style: DEFAULT_STYLE,
    watermark: DEFAULT_WATERMARK,
    exportProgress: null,
    hasUnsupportedBrowser:
      typeof window !== 'undefined' && !('VideoEncoder' in window),
    customFonts: [],
    past: [],
    future: [],

    setVideo: (blob, meta) => {
      const prev = get().videoUrl
      if (prev) URL.revokeObjectURL(prev)
      const url = URL.createObjectURL(blob)
      set({ videoBlob: blob, videoMeta: meta, videoUrl: url, currentTime: 0, isPlaying: false })
    },

    clearVideo: () => {
      const prev = get().videoUrl
      if (prev) URL.revokeObjectURL(prev)
      set({
        videoBlob: null,
        videoUrl: null,
        videoMeta: null,
        currentTime: 0,
        isPlaying: false,
        subtitles: [],
        selectedSubtitleId: null,
      })
    },

    setCurrentTime: (t) => set({ currentTime: t }),
    setPlaying: (p) => set({ isPlaying: p }),

    setSubtitles: (subs) => {
      get().pushHistory()
      set({
        subtitles: [...subs].sort((a, b) => a.start - b.start),
        selectedSubtitleId: null,
      })
    },

    addSubtitle: (start, end, text = '') => {
      get().pushHistory()
      const id = uid()
      const sub: Subtitle = { id, start, end, text }
      set((s) => {
        const list = [...s.subtitles, sub]
        const duration = s.videoMeta?.duration ?? Number.POSITIVE_INFINITY
        return {
          subtitles: resolveOverlap(list, id, duration),
          selectedSubtitleId: id,
        }
      })
      return id
    },

    updateSubtitle: (id, patch) =>
      set((s) => {
        const updated = s.subtitles.map((x) => (x.id === id ? { ...x, ...patch } : x))
        const timingChanged = 'start' in patch || 'end' in patch
        if (!timingChanged) {
          return { subtitles: updated.sort((a, b) => a.start - b.start) }
        }
        const duration = s.videoMeta?.duration ?? Number.POSITIVE_INFINITY
        return { subtitles: resolveOverlap(updated, id, duration) }
      }),

    removeSubtitle: (id) => {
      get().pushHistory()
      set((s) => ({
        subtitles: s.subtitles.filter((x) => x.id !== id),
        selectedSubtitleId: s.selectedSubtitleId === id ? null : s.selectedSubtitleId,
      }))
    },

    selectSubtitle: (id) => set({ selectedSubtitleId: id }),

    setStyle: (patch) =>
      set((s) => ({
        style: {
          ...s.style,
          ...patch,
          customY: clamp(patch.customY ?? s.style.customY, 0, 1),
          customX: clamp(patch.customX ?? s.style.customX, 0, 1),
        },
      })),

    setWatermark: (patch) => set((s) => ({ watermark: { ...s.watermark, ...patch } })),

    applySettings: (patch) => {
      if (!patch.style && !patch.watermark) return
      get().pushHistory()
      set((s) => {
        const style = patch.style
          ? {
              ...s.style,
              ...patch.style,
              customY: clamp(patch.style.customY ?? s.style.customY, 0, 1),
              customX: clamp(patch.style.customX ?? s.style.customX, 0, 1),
            }
          : s.style
        const watermark = patch.watermark
          ? { ...s.watermark, ...patch.watermark }
          : s.watermark
        return { style, watermark }
      })
    },

    pushHistory: () => {
      const s = get()
      const entry = snapshotHistory(s)
      const past = [...s.past, entry]
      if (past.length > MAX_HISTORY) past.shift()
      set({ past, future: [] })
    },

    undo: () => {
      const s = get()
      if (s.past.length === 0) return
      const prev = s.past[s.past.length - 1]
      const cur = snapshotHistory(s)
      set({
        ...prev,
        past: s.past.slice(0, -1),
        future: [cur, ...s.future],
      })
    },

    redo: () => {
      const s = get()
      if (s.future.length === 0) return
      const next = s.future[0]
      const cur = snapshotHistory(s)
      set({
        ...next,
        past: [...s.past, cur],
        future: s.future.slice(1),
      })
    },

    setExportProgress: (p) => set({ exportProgress: p }),

    addCustomFont: async (family, data) => {
      const buf = data.slice(0)
      await registerCustomFont(family, buf)
      get().pushHistory()
      const font: CustomFont = { id: uid(), family, data }
      set((s) => ({ customFonts: [...s.customFonts, font] }))
    },

    removeCustomFont: (id) => {
      get().pushHistory()
      set((s) => ({ customFonts: s.customFonts.filter((f) => f.id !== id) }))
    },

    hydrate: async (snap) => {
      if (snap.videoBlob && snap.videoMeta) {
        const url = URL.createObjectURL(snap.videoBlob)
        set({
          videoBlob: snap.videoBlob,
          videoMeta: snap.videoMeta,
          videoUrl: url,
        })
      }
      const fonts = snap.customFonts ?? []
      await Promise.allSettled(
        fonts.map((f) => registerCustomFont(f.family, f.data.slice(0))),
      )
      set({
        subtitles: snap.subtitles ?? [],
        style: { ...DEFAULT_STYLE, ...snap.style },
        watermark: { ...DEFAULT_WATERMARK, ...snap.watermark },
        customFonts: fonts,
      })
    },

    toSnapshot: () => {
      const s = get()
      return {
        videoBlob: s.videoBlob,
        videoMeta: s.videoMeta,
        subtitles: s.subtitles,
        style: s.style,
        watermark: s.watermark,
        customFonts: s.customFonts,
      }
    },
  })),
)

export function activeSubtitle(subs: Subtitle[], t: number): Subtitle | null {
  for (const s of subs) {
    if (t >= s.start && t < s.end) return s
  }
  return null
}
