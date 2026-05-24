import { useEditor } from '@/store/editor'
import type { Subtitle } from '@/types'
import { clamp } from '@/lib/utils'
import { SubtitleBlock } from './SubtitleBlock'

export function SubtitleTrack({
  subtitles,
  pxPerSec,
  duration,
}: {
  subtitles: Subtitle[]
  pxPerSec: number
  duration: number
}) {
  const selectedId = useEditor((s) => s.selectedSubtitleId)
  const setCurrentTime = useEditor((s) => s.setCurrentTime)
  const selectSubtitle = useEditor((s) => s.selectSubtitle)

  function onBgPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const t = clamp(x / pxPerSec, 0, duration)
    setCurrentTime(t)
    selectSubtitle(null)
  }

  return (
    <div
      className="relative h-full bg-zinc-950/40"
      onPointerDown={onBgPointerDown}
    >
      {subtitles.map((s) => (
        <SubtitleBlock
          key={s.id}
          subtitle={s}
          pxPerSec={pxPerSec}
          duration={duration}
          selected={selectedId === s.id}
        />
      ))}
    </div>
  )
}
