import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Plus, Trash2, ZoomIn, ZoomOut } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { TimeRuler } from './TimeRuler'
import { SubtitleTrack } from './SubtitleTrack'
import { formatTime, clamp, cn } from '@/lib/utils'

const MIN_PX_PER_SEC = 20
const MAX_PX_PER_SEC = 400
const LANE_H = 64

export function Timeline() {
  const meta = useEditor((s) => s.videoMeta)
  const currentTime = useEditor((s) => s.currentTime)
  const tracks = useEditor((s) => s.tracks)
  const activeTrackId = useEditor((s) => s.activeTrackId)
  const addCue = useEditor((s) => s.addCue)
  const removeCue = useEditor((s) => s.removeCue)
  const addTrack = useEditor((s) => s.addTrack)
  const selectedCueId = useEditor((s) => s.selectedCueId)
  const dropTargetTrackId = useEditor((s) => s.dropTargetTrackId)
  const [pxPerSec, setPxPerSec] = useState(100)

  const scrollRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [viewW, setViewW] = useState(0)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => setViewW(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        setPxPerSec((v) => {
          const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
          return clamp(Math.round(v * factor), MIN_PX_PER_SEC, MAX_PX_PER_SEC)
        })
        return
      }
      if (e.shiftKey) {
        e.preventDefault()
        el.scrollLeft += e.deltaY || e.deltaX
        return
      }
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault()
        el.scrollLeft += e.deltaX
      }
      // otherwise let the browser scroll lanes vertically
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  if (!meta) return null

  const totalWidth = Math.max(viewW, meta.duration * pxPerSec)
  const playheadLeft = currentTime * pxPerSec

  function addAtCurrent() {
    if (!meta) return
    const dur = Math.min(2, meta.duration - currentTime)
    if (dur <= 0.1) return
    addCue(currentTime, currentTime + dur, '新字幕')
  }

  function removeSelected() {
    if (!selectedCueId) return
    const tr = tracks.find((t) => t.cues.some((c) => c.id === selectedCueId))
    if (tr) removeCue(tr.id, selectedCueId)
  }

  function zoom(delta: number) {
    setPxPerSec((v) => clamp(Math.round(v * (delta > 0 ? 1.25 : 0.8)), MIN_PX_PER_SEC, MAX_PX_PER_SEC))
  }

  return (
    <div className="flex h-full flex-col border-t border-border bg-zinc-950">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <div className="flex gap-2">
          <button
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-zinc-800"
            onClick={addAtCurrent}
          >
            <Plus className="h-3 w-3" /> 新增字幕
          </button>
          <button
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-zinc-800"
            onClick={() => addTrack()}
          >
            <Plus className="h-3 w-3" /> 新增軌道
          </button>
          <button
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs disabled:opacity-30 hover:bg-zinc-800"
            disabled={!selectedCueId}
            onClick={removeSelected}
          >
            <Trash2 className="h-3 w-3" /> 刪除
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="font-mono">{formatTime(currentTime)}</span>
          <button
            className="rounded border border-border p-1 hover:bg-zinc-800"
            onClick={() => zoom(-1)}
            aria-label="zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="font-mono tabular-nums">{pxPerSec}px/s</span>
          <button
            className="rounded border border-border p-1 hover:bg-zinc-800"
            onClick={() => zoom(1)}
            aria-label="zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="relative flex-1 overflow-auto">
        <div ref={innerRef} className="relative" style={{ width: totalWidth }}>
          <TimeRuler duration={meta.duration} pxPerSec={pxPerSec} />
          <div>
            {tracks.map((track) => (
              <div
                key={track.id}
                data-track-id={track.id}
                className={cn(
                  'relative border-b border-border/40',
                  track.id === activeTrackId && 'bg-sky-500/[0.04]',
                  track.id === dropTargetTrackId && 'bg-sky-500/20 ring-1 ring-inset ring-sky-400',
                )}
                style={{ height: LANE_H }}
              >
                <SubtitleTrack
                  track={track}
                  pxPerSec={pxPerSec}
                  duration={meta.duration}
                  active={track.id === activeTrackId}
                />
              </div>
            ))}
          </div>
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-30 w-0.5 bg-red-500"
            style={{ left: playheadLeft }}
          />
        </div>
      </div>
    </div>
  )
}
