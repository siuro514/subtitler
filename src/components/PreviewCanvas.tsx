import { type PointerEvent as ReactPointerEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { activeCue, useEditor } from '@/store/editor'
import { clamp, formatTime } from '@/lib/utils'
import { loadWatermarkImage, measureTrackBox, renderFrame, trackAnchor } from '@/lib/render'
import { ensureFontLoaded } from '@/lib/fonts'

const MOVE_EPS = 0.004

export function PreviewCanvas() {
  const videoUrl = useEditor((s) => s.videoUrl)
  const meta = useEditor((s) => s.videoMeta)
  const isPlaying = useEditor((s) => s.isPlaying)
  const setPlaying = useEditor((s) => s.setPlaying)
  const setCurrentTime = useEditor((s) => s.setCurrentTime)
  const currentTime = useEditor((s) => s.currentTime)

  const tracks = useEditor((s) => s.tracks)
  const watermark = useEditor((s) => s.watermark)
  const activeTrackId = useEditor((s) => s.activeTrackId)
  const selectTrack = useEditor((s) => s.selectTrack)
  const updateTrack = useEditor((s) => s.updateTrack)
  const updateCue = useEditor((s) => s.updateCue)
  const pushHistory = useEditor((s) => s.pushHistory)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const watermarkImgRef = useRef<HTMLImageElement | null>(null)
  const measureCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const dragRef = useRef<
    | { mode: 'move'; grabDx: number; grabDy: number; startNx: number; startNy: number }
    | { mode: 'scale'; startDist: number; startFontSize: number }
    | { mode: 'rotate' }
    | null
  >(null)
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 })
  const [editing, setEditing] = useState(false)
  const editOriginalRef = useRef('')

  function getMeasureCtx() {
    if (!measureCtxRef.current) {
      measureCtxRef.current = document.createElement('canvas').getContext('2d')
    }
    return measureCtxRef.current
  }

  // Reads the latest state from the store so the rAF/rVFC playback loop (set up
  // once on [meta]) never draws stale tracks.
  function drawNow() {
    const canvas = canvasRef.current
    const v = videoRef.current
    const st = useEditor.getState()
    const m = st.videoMeta
    if (!canvas || !v || !m) return
    if (canvas.width !== m.width) canvas.width = m.width
    if (canvas.height !== m.height) canvas.height = m.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    renderFrame(ctx, {
      width: m.width,
      height: m.height,
      time: v.currentTime,
      tracks: st.tracks,
      watermark: st.watermark,
      watermarkImage: watermarkImgRef.current,
    })
  }

  useEffect(() => {
    let cancelled = false
    void loadWatermarkImage(watermark.imageDataUrl).then((img) => {
      if (!cancelled) {
        watermarkImgRef.current = img
        drawNow()
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watermark.imageDataUrl])

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) {
        setBoxSize((prev) =>
          prev.w === r.width && prev.h === r.height ? prev : { w: r.width, h: r.height },
        )
      }
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [meta])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (isPlaying && v.paused) v.play().catch(() => setPlaying(false))
    else if (!isPlaying && !v.paused) v.pause()
  }, [isPlaying, setPlaying])

  useEffect(() => {
    if (!meta) return
    function onKey(e: KeyboardEvent) {
      if (e.code !== 'Space' || e.repeat) return
      const t = e.target as HTMLElement | null
      if (!t) return
      const tag = t.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return
      e.preventDefault()
      setPlaying(!useEditor.getState().isPlaying)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [meta, setPlaying])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !meta) return
    if (Math.abs(v.currentTime - currentTime) > 0.05) {
      v.currentTime = currentTime
    }
  }, [currentTime, meta])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !meta) return
    const nudge = () => {
      if (v.currentTime === 0) {
        try {
          v.currentTime = 0.001
        } catch {
          // ignore
        }
      }
    }
    if (v.readyState >= 2) nudge()
    else v.addEventListener('loadeddata', nudge, { once: true })
    return () => v.removeEventListener('loadeddata', nudge)
  }, [meta])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !meta) return
    type VideoWithRVFC = HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number
      cancelVideoFrameCallback?: (id: number) => void
    }
    const vrvfc = v as VideoWithRVFC
    const useRvfc = typeof vrvfc.requestVideoFrameCallback === 'function'
    let handle = 0
    let stopped = false
    const tick = () => {
      if (stopped) return
      drawNow()
      handle = vrvfc.requestVideoFrameCallback!(tick)
    }
    if (useRvfc) {
      handle = vrvfc.requestVideoFrameCallback!(tick)
    } else {
      const raf = () => {
        if (stopped) return
        drawNow()
        handle = requestAnimationFrame(raf)
      }
      handle = requestAnimationFrame(raf)
    }
    return () => {
      stopped = true
      if (useRvfc) {
        vrvfc.cancelVideoFrameCallback?.(handle)
      } else {
        cancelAnimationFrame(handle)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta])

  useEffect(() => {
    drawNow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, watermark, currentTime])

  useEffect(() => {
    let cancelled = false
    void Promise.all(
      tracks.map((t) => {
        const text = t.cues.map((c) => c.text).join(' ')
        return text.trim() ? ensureFontLoaded(t.fontFamily, t.fontSize, text) : Promise.resolve()
      }),
    ).then(() => {
      if (!cancelled) drawNow()
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks])

  if (!videoUrl || !meta) return null

  const aspect = meta.width / meta.height || 1
  let dw = 0
  let dh = 0
  if (boxSize.w > 0 && boxSize.h > 0) {
    dw = boxSize.w
    dh = dw / aspect
    if (dh > boxSize.h) {
      dh = boxSize.h
      dw = dh * aspect
    }
  }

  const scaleDisp = meta.width > 0 ? dw / meta.width : 0

  // On-screen box for every track's current cue, so any card can be clicked to
  // select its track; the active track's box also gets the edit handles.
  interface Box {
    trackId: string
    cxD: number
    cyD: number
    wD: number
    hD: number
    rotation: number
  }
  const boxes: Box[] = []
  if (scaleDisp > 0) {
    const mctx = getMeasureCtx()
    if (mctx) {
      for (const track of tracks) {
        const c = activeCue(track.cues, currentTime)
        if (!c || !c.text.trim()) continue
        const box = measureTrackBox(mctx, track, c.text, meta.width, meta.height)
        const anchor = trackAnchor(track, meta.width, meta.height)
        const blockCenterX =
          anchor.align === 'left'
            ? anchor.cx + box.w / 2
            : anchor.align === 'right'
              ? anchor.cx - box.w / 2
              : anchor.cx
        boxes.push({
          trackId: track.id,
          cxD: blockCenterX * scaleDisp,
          cyD: anchor.cy * scaleDisp,
          wD: box.w * scaleDisp,
          hD: box.h * scaleDisp,
          rotation: track.rotation,
        })
      }
    }
  }
  const activeTrack = tracks.find((t) => t.id === activeTrackId) ?? null
  const activeBox = boxes.find((b) => b.trackId === activeTrackId) ?? null
  const editCue = activeTrack ? activeCue(activeTrack.cues, currentTime) : null

  function onMoveDown(e: ReactPointerEvent) {
    if (!activeTrack || !activeBox) return
    e.stopPropagation()
    e.preventDefault()
    pushHistory()
    const rect = frameRef.current!.getBoundingClientRect()
    dragRef.current = {
      mode: 'move',
      grabDx: e.clientX - rect.left - activeBox.cxD,
      grabDy: e.clientY - rect.top - activeBox.cyD,
      startNx: activeBox.cxD / dw,
      startNy: activeBox.cyD / dh,
    }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  function onScaleDown(e: ReactPointerEvent) {
    if (!activeTrack || !activeBox) return
    e.stopPropagation()
    e.preventDefault()
    pushHistory()
    const rect = frameRef.current!.getBoundingClientRect()
    const dx = e.clientX - rect.left - activeBox.cxD
    const dy = e.clientY - rect.top - activeBox.cyD
    dragRef.current = {
      mode: 'scale',
      startDist: Math.hypot(dx, dy) || 1,
      startFontSize: activeTrack.fontSize,
    }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  function onRotateDown(e: ReactPointerEvent) {
    if (!activeTrack || !activeBox) return
    e.stopPropagation()
    e.preventDefault()
    pushHistory()
    dragRef.current = { mode: 'rotate' }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  function onHandleMove(e: ReactPointerEvent) {
    const d = dragRef.current
    if (!d || !activeTrack || !activeBox) return
    const rect = frameRef.current!.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    if (d.mode === 'move') {
      const nx = clamp((px - d.grabDx) / dw, 0, 1)
      const ny = clamp((py - d.grabDy) / dh, 0, 1)
      const patch: Record<string, unknown> = {}
      // Only the axis that actually moved switches to custom placement.
      if (Math.abs(nx - d.startNx) > MOVE_EPS) {
        patch.positionX = 'custom'
        patch.customX = nx
      }
      if (Math.abs(ny - d.startNy) > MOVE_EPS) {
        patch.position = 'custom'
        patch.customY = ny
      }
      if (Object.keys(patch).length) updateTrack(activeTrack.id, patch)
    } else if (d.mode === 'scale') {
      const dist = Math.hypot(px - activeBox.cxD, py - activeBox.cyD)
      updateTrack(activeTrack.id, { fontSize: Math.round(d.startFontSize * (dist / d.startDist)) })
    } else if (d.mode === 'rotate') {
      const ang = (Math.atan2(py - activeBox.cyD, px - activeBox.cxD) * 180) / Math.PI
      updateTrack(activeTrack.id, { rotation: Math.round(ang + 90) })
    }
  }

  function onHandleUp(e: ReactPointerEvent) {
    if (!dragRef.current) return
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
    dragRef.current = null
  }

  function onSelectTrackDown(e: ReactPointerEvent, trackId: string) {
    e.stopPropagation()
    e.preventDefault()
    selectTrack(trackId)
  }

  function startEdit() {
    if (!activeTrack || !editCue) return
    editOriginalRef.current = editCue.text
    pushHistory()
    setEditing(true)
  }

  function cancelEdit() {
    if (activeTrack && editCue) updateCue(activeTrack.id, editCue.id, { text: editOriginalRef.current })
    setEditing(false)
  }

  return (
    <div className="flex h-full flex-col">
      <div
        ref={containerRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black"
      >
        {dw > 0 && dh > 0 && (
          <div ref={frameRef} className="relative" style={{ width: dw, height: dh }}>
            <video
              ref={videoRef}
              src={videoUrl}
              playsInline
              className="block h-full w-full"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onEnded={() => setPlaying(false)}
            />
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
            {/* Clickable card for each non-active track's current cue. */}
            {boxes
              .filter((b) => b.trackId !== activeTrackId)
              .map((b) => (
                <div
                  key={b.trackId}
                  className="absolute cursor-pointer rounded-sm ring-1 ring-transparent hover:ring-sky-400/60"
                  style={{
                    left: b.cxD - b.wD / 2,
                    top: b.cyD - b.hD / 2,
                    width: b.wD,
                    height: b.hD,
                    transform: `rotate(${b.rotation}deg)`,
                    transformOrigin: 'center',
                    touchAction: 'none',
                  }}
                  onPointerDown={(e) => onSelectTrackDown(e, b.trackId)}
                />
              ))}
            {activeBox && !editing && (
              <div
                className="absolute"
                style={{
                  left: activeBox.cxD - activeBox.wD / 2,
                  top: activeBox.cyD - activeBox.hD / 2,
                  width: activeBox.wD,
                  height: activeBox.hD,
                  transform: `rotate(${activeBox.rotation}deg)`,
                  transformOrigin: 'center',
                }}
              >
                <div
                  className="absolute inset-0 cursor-move ring-2 ring-sky-400"
                  style={{ touchAction: 'none' }}
                  onPointerDown={onMoveDown}
                  onPointerMove={onHandleMove}
                  onPointerUp={onHandleUp}
                  onDoubleClick={startEdit}
                  title="雙擊編輯文字"
                />
                {/* scale handle (bottom-right corner) */}
                <div
                  className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-full border border-white bg-sky-400"
                  style={{ touchAction: 'none' }}
                  onPointerDown={onScaleDown}
                  onPointerMove={onHandleMove}
                  onPointerUp={onHandleUp}
                />
                {/* rotate handle (above top edge) */}
                <div
                  className="absolute -top-7 left-1/2 h-3 w-3 -translate-x-1/2 cursor-grab rounded-full border border-white bg-emerald-400"
                  style={{ touchAction: 'none' }}
                  onPointerDown={onRotateDown}
                  onPointerMove={onHandleMove}
                  onPointerUp={onHandleUp}
                />
                <div className="pointer-events-none absolute -top-7 left-1/2 h-7 w-px -translate-x-1/2 bg-emerald-400/60" />
              </div>
            )}
            {activeBox && editing && editCue && (
              <textarea
                autoFocus
                className="absolute z-10 resize-none rounded-sm border border-sky-400 bg-zinc-900/95 px-2 py-1 text-center text-sm text-white outline-none"
                style={{
                  left: activeBox.cxD - Math.max(activeBox.wD, 180) / 2,
                  top: activeBox.cyD - Math.max(activeBox.hD, 56) / 2,
                  width: Math.max(activeBox.wD, 180),
                  height: Math.max(activeBox.hD, 56),
                }}
                value={editCue.text}
                onFocusCapture={(e) => e.currentTarget.select()}
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => updateCue(activeTrack!.id, editCue.id, { text: e.target.value })}
                onBlur={() => setEditing(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    setEditing(false)
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    cancelEdit()
                  }
                }}
              />
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 border-t border-border bg-zinc-900 px-4 py-2">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
          onClick={() => setPlaying(!isPlaying)}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <div className="font-mono text-xs tabular-nums text-zinc-400">
          {formatTime(currentTime)} / {formatTime(meta.duration)}
        </div>
        <input
          type="range"
          className="flex-1 accent-zinc-300"
          min={0}
          max={meta.duration}
          step={0.001}
          value={currentTime}
          onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
        />
      </div>
    </div>
  )
}
