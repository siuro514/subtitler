import { useEditor } from '@/store/editor'
import type { Track } from '@/types'
import { clamp } from '@/lib/utils'
import { SubtitleBlock } from './SubtitleBlock'

export function SubtitleTrack({
  track,
  pxPerSec,
  duration,
  active,
}: {
  track: Track
  pxPerSec: number
  duration: number
  active: boolean
}) {
  const selectedId = useEditor((s) => s.selectedCueId)
  const setCurrentTime = useEditor((s) => s.setCurrentTime)
  const selectCue = useEditor((s) => s.selectCue)
  const selectTrack = useEditor((s) => s.selectTrack)

  function onBgPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const t = clamp(x / pxPerSec, 0, duration)
    setCurrentTime(t)
    selectTrack(track.id)
    selectCue(null)
  }

  return (
    <div className="relative h-full bg-zinc-950/40" onPointerDown={onBgPointerDown}>
      <span
        className={
          'pointer-events-none absolute left-1 top-1 z-20 rounded px-1 text-[10px] ' +
          (active ? 'bg-sky-500/30 text-sky-100' : 'bg-zinc-800/70 text-zinc-400')
        }
      >
        {track.name}
      </span>
      {track.cues.map((c) => (
        <SubtitleBlock
          key={c.id}
          trackId={track.id}
          subtitle={c}
          pxPerSec={pxPerSec}
          duration={duration}
          selected={selectedId === c.id}
        />
      ))}
    </div>
  )
}
