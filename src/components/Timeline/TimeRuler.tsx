import { useRef } from 'react'
import { useEditor } from '@/store/editor'
import { clamp, formatTime } from '@/lib/utils'

export function TimeRuler({ duration, pxPerSec }: { duration: number; pxPerSec: number }) {
  const setCurrentTime = useEditor((s) => s.setCurrentTime)
  const ref = useRef<HTMLDivElement>(null)
  const scrubbing = useRef(false)

  function seekTo(clientX: number) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setCurrentTime(clamp((clientX - rect.left) / pxPerSec, 0, duration))
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    scrubbing.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    seekTo(e.clientX)
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (scrubbing.current) seekTo(e.clientX)
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    scrubbing.current = false
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
  }

  const majorStep = pxPerSec >= 100 ? 1 : pxPerSec >= 40 ? 5 : 10
  const minorStep = majorStep / 5
  const total = Math.ceil(duration / minorStep)
  const ticks: { t: number; major: boolean }[] = []
  for (let i = 0; i <= total; i++) {
    const t = i * minorStep
    if (t > duration) break
    const major = Math.abs((t / majorStep) - Math.round(t / majorStep)) < 1e-6
    ticks.push({ t, major })
  }
  return (
    <div
      ref={ref}
      className="relative h-7 cursor-pointer select-none border-b border-border bg-zinc-900 text-zinc-500"
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {ticks.map((tick, i) => (
        <div
          key={i}
          className="absolute top-0 flex h-full flex-col items-start"
          style={{ left: tick.t * pxPerSec }}
        >
          <div
            className={
              'w-px ' + (tick.major ? 'h-3 bg-zinc-500' : 'h-1.5 bg-zinc-700')
            }
          />
          {tick.major && (
            <span className="ml-1 mt-0.5 text-[10px] font-mono leading-none">
              {formatTime(tick.t).replace(/\.\d+$/, '')}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
