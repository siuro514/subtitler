import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { useEditor } from '@/store/editor'
import { formatTime } from '@/lib/utils'
import { loadWatermarkImage, renderFrame } from '@/lib/render'
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

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const watermarkImgRef = useRef<HTMLImageElement | null>(null)
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 })

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
  }, [subtitles, style, watermark, currentTime])

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

  return (
    <div className="flex h-full flex-col">
      <div
        ref={containerRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black"
      >
        {dw > 0 && dh > 0 && (
          <div className="relative" style={{ width: dw, height: dh }}>
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
