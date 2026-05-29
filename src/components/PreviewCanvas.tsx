import { type PointerEvent as ReactPointerEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { clamp, cn, formatTime } from '@/lib/utils'
import { loadWatermarkImage, measureLabelBox, renderFrame } from '@/lib/render'
import { ensureFontLoaded } from '@/lib/fonts'

export function PreviewCanvas() {
  const videoUrl = useEditor((s) => s.videoUrl)
  const meta = useEditor((s) => s.videoMeta)
  const isPlaying = useEditor((s) => s.isPlaying)
  const setPlaying = useEditor((s) => s.setPlaying)
  const setCurrentTime = useEditor((s) => s.setCurrentTime)
  const currentTime = useEditor((s) => s.currentTime)

  const subtitles = useEditor((s) => s.subtitles)
  const style = useEditor((s) => s.style)
  const watermark = useEditor((s) => s.watermark)
  const labels = useEditor((s) => s.labels)
  const selectedLabelId = useEditor((s) => s.selectedLabelId)
  const selectLabel = useEditor((s) => s.selectLabel)
  const updateLabel = useEditor((s) => s.updateLabel)
  const pushHistory = useEditor((s) => s.pushHistory)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const watermarkImgRef = useRef<HTMLImageElement | null>(null)
  const measureCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const dragRef = useRef<{ id: string; grabDx: number; grabDy: number } | null>(null)
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 })

  function getMeasureCtx() {
    if (!measureCtxRef.current) {
      measureCtxRef.current = document.createElement('canvas').getContext('2d')
    }
    return measureCtxRef.current
  }

  function drawNow() {
    const canvas = canvasRef.current
    const v = videoRef.current
    if (!canvas || !v || !meta) return
    if (canvas.width !== meta.width) canvas.width = meta.width
    if (canvas.height !== meta.height) canvas.height = meta.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    renderFrame(ctx, {
      width: meta.width,
      height: meta.height,
      time: v.currentTime,
      subtitles,
      style,
      watermark,
      watermarkImage: watermarkImgRef.current,
      labels,
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
  }, [subtitles, style, watermark, labels, currentTime])

  useEffect(() => {
    let cancelled = false
    const text = subtitles.map((s) => s.text).join(' ')
    if (!text) return
    void ensureFontLoaded(style.fontFamily, style.fontSize, text).then(() => {
      if (!cancelled) drawNow()
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style.fontFamily, style.fontSize, subtitles])

  useEffect(() => {
    let cancelled = false
    void Promise.all(
      labels
        .filter((l) => l.text.trim())
        .map((l) => ensureFontLoaded(l.fontFamily, l.fontSize, l.text)),
    ).then(() => {
      if (!cancelled) drawNow()
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels])

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

  function labelRect(l: (typeof labels)[number]) {
    const mctx = getMeasureCtx()
    let w = 0
    let h = 0
    if (mctx && scaleDisp > 0) {
      const b = measureLabelBox(mctx, l, meta!.width, meta!.height)
      w = b.w * scaleDisp
      h = b.h * scaleDisp
    }
    return { left: l.x * dw - w / 2, top: l.y * dh - h / 2, width: w, height: h }
  }

  function onLabelPointerDown(e: ReactPointerEvent, l: (typeof labels)[number]) {
    e.stopPropagation()
    e.preventDefault()
    selectLabel(l.id)
    pushHistory() // one history entry per drag gesture
    const rect = frameRef.current!.getBoundingClientRect()
    dragRef.current = {
      id: l.id,
      grabDx: e.clientX - rect.left - l.x * dw,
      grabDy: e.clientY - rect.top - l.y * dh,
    }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  function onLabelPointerMove(e: ReactPointerEvent) {
    const d = dragRef.current
    if (!d) return
    const rect = frameRef.current!.getBoundingClientRect()
    const cxD = e.clientX - rect.left - d.grabDx
    const cyD = e.clientY - rect.top - d.grabDy
    updateLabel(d.id, { x: clamp(cxD / dw, 0, 1), y: clamp(cyD / dh, 0, 1) })
  }

  function onLabelPointerUp(e: ReactPointerEvent) {
    if (!dragRef.current) return
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
    dragRef.current = null
  }

  return (
    <div className="flex h-full flex-col">
      <div
        ref={containerRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black"
      >
        {dw > 0 && dh > 0 && (
          <div
            ref={frameRef}
            className="relative"
            style={{ width: dw, height: dh }}
            onPointerDown={() => selectLabel(null)}
          >
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
            {labels.map((l) => {
              const r = labelRect(l)
              const selected = l.id === selectedLabelId
              return (
                <div
                  key={l.id}
                  role="button"
                  aria-label={`文字標籤：${l.text}`}
                  onPointerDown={(e) => onLabelPointerDown(e, l)}
                  onPointerMove={onLabelPointerMove}
                  onPointerUp={onLabelPointerUp}
                  className={cn(
                    'absolute cursor-move rounded-sm',
                    selected
                      ? 'ring-2 ring-sky-400'
                      : 'ring-1 ring-transparent hover:ring-sky-400/40',
                  )}
                  style={{
                    left: r.left,
                    top: r.top,
                    width: r.width,
                    height: r.height,
                    touchAction: 'none',
                  }}
                />
              )
            })}
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
