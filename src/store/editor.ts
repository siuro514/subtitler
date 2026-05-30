import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  DEFAULT_STYLE,
  DEFAULT_TRACK_EXTRAS,
  DEFAULT_WATERMARK,
  type CustomFont,
  type ProjectSnapshot,
  type Subtitle,
  type SubtitleStyle,
  type TextStyleCore,
  type Track,
  type VideoMeta,
  type Watermark,
} from '@/types'
import { clamp, uid } from '@/lib/utils'
import { registerCustomFont } from '@/lib/fonts'
import { resolveOverlap } from '@/lib/overlap'

interface HistoryEntry {
  tracks: Track[]
  watermark: Watermark
  customFonts: CustomFont[]
}

const MAX_HISTORY = 50

/** Pre multi-track snapshot shape, accepted by hydrate for migration. */
type LegacyLabel = TextStyleCore & { id: string; text: string; x: number; y: number }
type StoredProject = Omit<ProjectSnapshot, 'tracks'> & {
  tracks?: Track[]
  subtitles?: Subtitle[]
  style?: Partial<SubtitleStyle>
  labels?: LegacyLabel[]
}

export function makeTrack(patch: Partial<Track> = {}): Track {
  return {
    ...DEFAULT_STYLE,
    ...DEFAULT_TRACK_EXTRAS,
    id: uid(),
    name: '軌道',
    cues: [],
    ...patch,
  }
}

interface EditorState {
  videoBlob: Blob | null
  videoUrl: string | null
  videoMeta: VideoMeta | null
  currentTime: number
  isPlaying: boolean
  tracks: Track[]
  activeTrackId: string | null
  selectedCueId: string | null
  /** Track lane currently hovered as a drop target while dragging a cue (transient UI). */
  dropTargetTrackId: string | null
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

  addTrack: () => string
  removeTrack: (id: string) => void
  updateTrack: (id: string, patch: Partial<Track>) => void
  selectTrack: (id: string | null) => void

  addCue: (start: number, end: number, text?: string) => string
  updateCue: (trackId: string, cueId: string, patch: Partial<Subtitle>) => void
  removeCue: (trackId: string, cueId: string) => void
  setActiveTrackCues: (cues: Subtitle[]) => void
  moveCueToTrack: (fromTrackId: string, toTrackId: string, cueId: string) => void
  selectCue: (id: string | null) => void
  setDropTarget: (id: string | null) => void

  setStyle: (patch: Partial<SubtitleStyle>) => void
  setWatermark: (patch: Partial<Watermark>) => void
  applySettings: (patch: { style?: Partial<SubtitleStyle>; watermark?: Partial<Watermark> }) => void
  setExportProgress: (p: number | null) => void
  addCustomFont: (family: string, data: ArrayBuffer) => Promise<void>
  removeCustomFont: (id: string) => void
  pushHistory: () => void
  undo: () => void
  redo: () => void
  hydrate: (snap: StoredProject) => Promise<void>
  toSnapshot: () => ProjectSnapshot
}

function snapshotHistory(s: {
  tracks: Track[]
  watermark: Watermark
  customFonts: CustomFont[]
}): HistoryEntry {
  return { tracks: s.tracks, watermark: s.watermark, customFonts: s.customFonts }
}

export const useEditor = create<EditorState>()(
  subscribeWithSelector((set, get) => ({
    videoBlob: null,
    videoUrl: null,
    videoMeta: null,
    currentTime: 0,
    isPlaying: false,
    tracks: [],
    activeTrackId: null,
    selectedCueId: null,
    dropTargetTrackId: null,
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
      set((s) => {
        const base = {
          videoBlob: blob,
          videoMeta: meta,
          videoUrl: url,
          currentTime: 0,
          isPlaying: false,
        }
        if (s.tracks.length === 0) {
          const t = makeTrack({ name: '字幕' })
          return { ...base, tracks: [t], activeTrackId: t.id }
        }
        return base
      })
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
        tracks: [],
        activeTrackId: null,
        selectedCueId: null,
      })
    },

    setCurrentTime: (t) => set({ currentTime: t }),
    setPlaying: (p) => set({ isPlaying: p }),

    addTrack: () => {
      get().pushHistory()
      const t = makeTrack({ name: `軌道 ${get().tracks.length + 1}` })
      set((s) => ({ tracks: [...s.tracks, t], activeTrackId: t.id }))
      return t.id
    },

    removeTrack: (id) => {
      get().pushHistory()
      set((s) => {
        const tracks = s.tracks.filter((t) => t.id !== id)
        return {
          tracks,
          activeTrackId: s.activeTrackId === id ? (tracks[0]?.id ?? null) : s.activeTrackId,
          selectedCueId: null,
        }
      })
    },

    // No history push: used for live edits (sliders, canvas drag/scale/rotate).
    // Callers snapshot once on interaction start.
    updateTrack: (id, patch) =>
      set((s) => ({
        tracks: s.tracks.map((t) =>
          t.id === id
            ? {
                ...t,
                ...patch,
                customY: clamp(patch.customY ?? t.customY, 0, 1),
                customX: clamp(patch.customX ?? t.customX, 0, 1),
                fontSize: clamp(patch.fontSize ?? t.fontSize, 4, 400),
              }
            : t,
        ),
      })),

    selectTrack: (id) => set({ activeTrackId: id }),

    addCue: (start, end, text = '') => {
      let activeId = get().activeTrackId
      if (!activeId || !get().tracks.some((t) => t.id === activeId)) {
        activeId = get().addTrack()
      } else {
        get().pushHistory()
      }
      const id = uid()
      const cue: Subtitle = { id, start, end, text }
      set((s) => {
        const duration = s.videoMeta?.duration ?? Number.POSITIVE_INFINITY
        return {
          tracks: s.tracks.map((t) =>
            t.id === activeId
              ? { ...t, cues: resolveOverlap([...t.cues, cue], id, duration) }
              : t,
          ),
          selectedCueId: id,
        }
      })
      return id
    },

    updateCue: (trackId, cueId, patch) =>
      set((s) => ({
        tracks: s.tracks.map((t) => {
          if (t.id !== trackId) return t
          const updated = t.cues.map((c) => (c.id === cueId ? { ...c, ...patch } : c))
          const timingChanged = 'start' in patch || 'end' in patch
          if (!timingChanged) {
            return { ...t, cues: updated.sort((a, b) => a.start - b.start) }
          }
          const duration = s.videoMeta?.duration ?? Number.POSITIVE_INFINITY
          return { ...t, cues: resolveOverlap(updated, cueId, duration) }
        }),
      })),

    removeCue: (trackId, cueId) => {
      get().pushHistory()
      set((s) => ({
        tracks: s.tracks.map((t) =>
          t.id === trackId ? { ...t, cues: t.cues.filter((c) => c.id !== cueId) } : t,
        ),
        selectedCueId: s.selectedCueId === cueId ? null : s.selectedCueId,
      }))
    },

    setActiveTrackCues: (cues) => {
      let activeId = get().activeTrackId
      if (!activeId || !get().tracks.some((t) => t.id === activeId)) {
        activeId = get().addTrack()
      } else {
        get().pushHistory()
      }
      const sorted = [...cues].sort((a, b) => a.start - b.start)
      set((s) => ({
        tracks: s.tracks.map((t) => (t.id === activeId ? { ...t, cues: sorted } : t)),
        selectedCueId: null,
      }))
    },

    // Reassign a cue to another track, keeping its current timing and resolving
    // overlap within the destination. History is pushed by the drag start.
    moveCueToTrack: (fromTrackId, toTrackId, cueId) => {
      if (fromTrackId === toTrackId) return
      set((s) => {
        const from = s.tracks.find((t) => t.id === fromTrackId)
        const cue = from?.cues.find((c) => c.id === cueId)
        if (!cue) return {}
        const duration = s.videoMeta?.duration ?? Number.POSITIVE_INFINITY
        return {
          tracks: s.tracks.map((t) => {
            if (t.id === fromTrackId) return { ...t, cues: t.cues.filter((c) => c.id !== cueId) }
            if (t.id === toTrackId) {
              return { ...t, cues: resolveOverlap([...t.cues, cue], cueId, duration) }
            }
            return t
          }),
          activeTrackId: toTrackId,
        }
      })
    },

    selectCue: (id) => set({ selectedCueId: id }),

    setDropTarget: (id) => set({ dropTargetTrackId: id }),

    setStyle: (patch) => {
      const id = get().activeTrackId
      if (id) get().updateTrack(id, patch)
    },

    setWatermark: (patch) => set((s) => ({ watermark: { ...s.watermark, ...patch } })),

    applySettings: (patch) => {
      if (!patch.style && !patch.watermark) return
      get().pushHistory()
      set((s) => {
        const tracks =
          patch.style && s.activeTrackId
            ? s.tracks.map((t) =>
                t.id === s.activeTrackId
                  ? {
                      ...t,
                      ...patch.style,
                      customY: clamp(patch.style!.customY ?? t.customY, 0, 1),
                      customX: clamp(patch.style!.customX ?? t.customX, 0, 1),
                    }
                  : t,
              )
            : s.tracks
        const watermark = patch.watermark ? { ...s.watermark, ...patch.watermark } : s.watermark
        return { tracks, watermark }
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
        set({ videoBlob: snap.videoBlob, videoMeta: snap.videoMeta, videoUrl: url })
      }
      const fonts = snap.customFonts ?? []
      await Promise.allSettled(
        fonts.map((f) => registerCustomFont(f.family, f.data.slice(0))),
      )

      const duration = snap.videoMeta?.duration ?? 0
      let tracks: Track[]
      if (snap.tracks) {
        // Backfill missing fields, and fold the removed per-track `scale` into
        // fontSize so projects saved with the old scale control look the same.
        tracks = snap.tracks.map((t) => {
          const { scale, ...rest } = t as Track & { scale?: number }
          const merged = { ...makeTrack(), ...rest }
          if (scale && scale !== 1) merged.fontSize = Math.round(merged.fontSize * scale)
          return merged
        })
      } else {
        // Migrate legacy single-track + labels project.
        tracks = []
        if ((snap.subtitles && snap.subtitles.length > 0) || snap.style) {
          tracks.push(makeTrack({ ...snap.style, name: '字幕', cues: snap.subtitles ?? [] }))
        }
        for (const l of snap.labels ?? []) {
          const { id: _id, text, x, y, ...core } = l
          tracks.push(
            makeTrack({
              ...core,
              name: text.slice(0, 8) || '標籤',
              position: 'custom',
              customY: y,
              positionX: 'custom',
              customX: x,
              cues: [{ id: uid(), start: 0, end: duration, text }],
            }),
          )
        }
      }

      set({
        tracks,
        activeTrackId: tracks[0]?.id ?? null,
        selectedCueId: null,
        watermark: { ...DEFAULT_WATERMARK, ...snap.watermark },
        customFonts: fonts,
      })
    },

    toSnapshot: () => {
      const s = get()
      return {
        videoBlob: s.videoBlob,
        videoMeta: s.videoMeta,
        tracks: s.tracks,
        watermark: s.watermark,
        customFonts: s.customFonts,
      }
    },
  })),
)

export function activeCue(cues: Subtitle[], t: number): Subtitle | null {
  for (const c of cues) {
    if (t >= c.start && t < c.end) return c
  }
  return null
}
