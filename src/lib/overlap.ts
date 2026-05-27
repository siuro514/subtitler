import type { Subtitle } from '@/types'

const MIN_DURATION = 0.1
const EPSILON = 1e-4

export function resolveOverlap(
  subs: Subtitle[],
  anchorId: string,
  duration: number,
): Subtitle[] {
  const sorted = [...subs].sort((a, b) => a.start - b.start)
  const anchorIdx = sorted.findIndex((s) => s.id === anchorId)
  if (anchorIdx < 0) return sorted

  for (let i = anchorIdx - 1; i >= 0; i--) {
    const next = sorted[i + 1]
    const cur = sorted[i]
    if (cur.end <= next.start + EPSILON) break
    const dur = cur.end - cur.start
    let newEnd = next.start
    let newStart = newEnd - dur
    if (newStart < 0) {
      newStart = 0
      if (newEnd - newStart < MIN_DURATION) newEnd = newStart + MIN_DURATION
    }
    sorted[i] = { ...cur, start: newStart, end: newEnd }
  }

  const anchorStart = sorted[anchorIdx].start
  let prevEnd = 0
  for (let i = 0; i < anchorIdx; i++) {
    const cur = sorted[i]
    const dur = cur.end - cur.start
    let s = Math.max(cur.start, prevEnd)
    let e = s + dur
    if (e > anchorStart) {
      e = anchorStart
      s = Math.max(prevEnd, e - dur)
      if (e - s < MIN_DURATION) s = Math.max(0, e - MIN_DURATION)
      if (e - s < MIN_DURATION) e = s + MIN_DURATION
    }
    sorted[i] = { ...cur, start: s, end: e }
    prevEnd = e
  }

  prevEnd = sorted[anchorIdx].end
  for (let i = anchorIdx + 1; i < sorted.length; i++) {
    const cur = sorted[i]
    if (cur.start >= prevEnd - EPSILON) break
    const dur = cur.end - cur.start
    let s = prevEnd
    let e = s + dur
    if (e > duration) {
      e = duration
      s = Math.max(prevEnd, e - dur)
      if (e - s < MIN_DURATION) s = Math.max(0, e - MIN_DURATION)
      if (e - s < MIN_DURATION) e = s + MIN_DURATION
    }
    sorted[i] = { ...cur, start: s, end: e }
    prevEnd = e
  }

  return sorted
}
