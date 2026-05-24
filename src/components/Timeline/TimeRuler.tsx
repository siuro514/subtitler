import { formatTime } from '@/lib/utils'

export function TimeRuler({ duration, pxPerSec }: { duration: number; pxPerSec: number }) {
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
    <div className="relative h-7 border-b border-border bg-zinc-900 text-zinc-500">
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
