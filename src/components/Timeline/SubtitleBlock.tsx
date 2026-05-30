import { useRef, useState } from 'react'
import { useEditor } from '@/store/editor'
import type { Subtitle } from '@/types'
import { clamp } from '@/lib/utils'

interface Props {
  trackId: string
  subtitle: Subtitle
  pxPerSec: number
  duration: number
  selected: boolean
}

type DragMode = 'move' | 'resize-left' | 'resize-right'

const MIN_DURATION = 0.1

/** Track id of the timeline lane under a screen point, if any. */
function trackIdAtPoint(x: number, y: number): string | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const id = (el as HTMLElement).dataset?.trackId
    if (id) return id
  }
  return null
}

export function SubtitleBlock({ trackId, subtitle, pxPerSec, duration, selected }: Props) {
  const updateCue = useEditor((s) => s.updateCue)
  const selectCue = useEditor((s) => s.selectCue)
  const selectTrack = useEditor((s) => s.selectTrack)
  const setDropTarget = useEditor((s) => s.setDropTarget)
  const moveCueToTrack = useEditor((s) => s.moveCueToTrack)
  const pushHistory = useEditor((s) => s.pushHistory)
  const editingRef = useRef<HTMLDivElement>(null)
  const [editing, setEditing] = useState(false)

  const left = subtitle.start * pxPerSec
  const width = Math.max(2, (subtitle.end - subtitle.start) * pxPerSec)

  function startDrag(mode: DragMode, e: React.PointerEvent) {
    if (editing) return
    e.stopPropagation()
    e.preventDefault()
    selectTrack(trackId)
    selectCue(subtitle.id)
    pushHistory()
    const startX = e.clientX
    const origStart = subtitle.start
    const origEnd = subtitle.end
    const origDur = origEnd - origStart
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    function onMove(ev: PointerEvent) {
      const dx = (ev.clientX - startX) / pxPerSec
      if (mode === 'move') {
        const newStart = clamp(origStart + dx, 0, duration - origDur)
        updateCue(trackId, subtitle.id, { start: newStart, end: newStart + origDur })
        const tgt = trackIdAtPoint(ev.clientX, ev.clientY)
        setDropTarget(tgt && tgt !== trackId ? tgt : null)
      } else if (mode === 'resize-left') {
        const newStart = clamp(origStart + dx, 0, origEnd - MIN_DURATION)
        updateCue(trackId, subtitle.id, { start: newStart })
      } else if (mode === 'resize-right') {
        const newEnd = clamp(origEnd + dx, origStart + MIN_DURATION, duration)
        updateCue(trackId, subtitle.id, { end: newEnd })
      }
    }

    function onUp(ev: PointerEvent) {
      target.releasePointerCapture(ev.pointerId)
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      if (mode === 'move') {
        const dropId = useEditor.getState().dropTargetTrackId
        if (dropId && dropId !== trackId) moveCueToTrack(trackId, dropId, subtitle.id)
        setDropTarget(null)
      }
    }

    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  function onDoubleClick(e: React.MouseEvent) {
    e.stopPropagation()
    setEditing(true)
    setTimeout(() => {
      const el = editingRef.current
      if (el) {
        el.focus()
        const range = document.createRange()
        range.selectNodeContents(el)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    }, 0)
  }

  function commitEdit() {
    const text = editingRef.current?.innerText.trim() ?? ''
    setEditing(false)
    if (text !== subtitle.text) {
      pushHistory()
      updateCue(trackId, subtitle.id, { text })
    }
  }

  return (
    <div
      className={
        'absolute top-2 z-10 flex h-12 items-center rounded-sm border text-xs ' +
        (selected
          ? 'border-zinc-100 bg-zinc-700/80 shadow-lg'
          : 'border-zinc-600 bg-zinc-800/70 hover:bg-zinc-700/70')
      }
      style={{ left, width }}
      onDoubleClick={onDoubleClick}
      onPointerDown={(e) => startDrag('move', e)}
    >
      <div
        className="absolute left-0 top-0 z-20 h-full w-1.5 cursor-ew-resize bg-zinc-100/0 hover:bg-zinc-100/30"
        onPointerDown={(e) => startDrag('resize-left', e)}
      />
      <div
        className="absolute right-0 top-0 z-20 h-full w-1.5 cursor-ew-resize bg-zinc-100/0 hover:bg-zinc-100/30"
        onPointerDown={(e) => startDrag('resize-right', e)}
      />
      {editing ? (
        <div
          ref={editingRef}
          className="mx-2 flex-1 overflow-hidden whitespace-nowrap rounded-sm bg-zinc-900 px-1 text-zinc-100 outline-none"
          contentEditable
          suppressContentEditableWarning
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              commitEdit()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              setEditing(false)
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {subtitle.text}
        </div>
      ) : (
        <div className="mx-2 flex-1 select-none overflow-hidden whitespace-nowrap text-zinc-100">
          {subtitle.text || <span className="text-zinc-500">（空字幕）</span>}
        </div>
      )}
    </div>
  )
}
