import type { Subtitle } from '@/types'
import { uid } from './utils'

export interface AsrWord {
  start: number
  end: number
  text: string
}

interface LyricChar {
  ch: string
  lineIdx: number
}

interface AsrChar {
  ch: string
  t: number
  tEnd: number
}

const NORMALIZE_RE = /[\s\p{P}\p{S}]/gu

function normChar(c: string): string {
  return c.toLowerCase()
}

function flattenLyrics(lines: string[]): LyricChar[] {
  const out: LyricChar[] = []
  for (let i = 0; i < lines.length; i++) {
    const cleaned = lines[i].replace(NORMALIZE_RE, '')
    for (const ch of Array.from(cleaned)) {
      out.push({ ch: normChar(ch), lineIdx: i })
    }
  }
  return out
}

function flattenAsrWords(words: AsrWord[]): AsrChar[] {
  const out: AsrChar[] = []
  for (const w of words) {
    const text = w.text.replace(NORMALIZE_RE, '')
    const chars = Array.from(text)
    if (chars.length === 0) continue
    const total = Math.max(0.01, w.end - w.start)
    const per = total / chars.length
    for (let i = 0; i < chars.length; i++) {
      out.push({
        ch: normChar(chars[i]),
        t: w.start + i * per,
        tEnd: w.start + (i + 1) * per,
      })
    }
  }
  return out
}

const MATCH = 2
const MISMATCH = -1
const GAP = -2

interface Pair {
  asrIdx: number
  lyricIdx: number
}

function alignSequences(asr: AsrChar[], lyric: LyricChar[]): Pair[] {
  const n = asr.length
  const m = lyric.length
  if (n === 0 || m === 0) return []

  const width = m + 1
  const dp = new Int32Array((n + 1) * width)
  const trace = new Uint8Array((n + 1) * width)

  for (let i = 0; i <= n; i++) {
    dp[i * width] = i * GAP
    trace[i * width] = 1
  }
  for (let j = 0; j <= m; j++) {
    dp[j] = j * GAP
    trace[j] = 2
  }
  trace[0] = 0

  for (let i = 1; i <= n; i++) {
    const rowBase = i * width
    for (let j = 1; j <= m; j++) {
      const idx = rowBase + j
      const score = asr[i - 1].ch === lyric[j - 1].ch ? MATCH : MISMATCH
      const diag = dp[(i - 1) * width + (j - 1)] + score
      const up = dp[(i - 1) * width + j] + GAP
      const left = dp[rowBase + (j - 1)] + GAP
      let best = diag
      let dir = 0
      if (up > best) {
        best = up
        dir = 1
      }
      if (left > best) {
        best = left
        dir = 2
      }
      dp[idx] = best
      trace[idx] = dir
    }
  }

  const pairs: Pair[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    const idx = i * width + j
    const dir = trace[idx]
    if (i > 0 && j > 0 && dir === 0) {
      if (asr[i - 1].ch === lyric[j - 1].ch) {
        pairs.push({ asrIdx: i - 1, lyricIdx: j - 1 })
      }
      i--
      j--
    } else if (i > 0 && dir === 1) {
      i--
    } else if (j > 0 && dir === 2) {
      j--
    } else {
      break
    }
  }
  pairs.reverse()
  return pairs
}

export interface AlignmentDebug {
  asrCharCount: number
  lyricCharCount: number
  matchedChars: number
  unmappedLineCount: number
}

export interface AlignmentResult {
  subtitles: Subtitle[]
  debug: AlignmentDebug
}

export function alignLyricsByContent(
  lyrics: string[],
  asrWords: AsrWord[],
  totalDuration: number,
): AlignmentResult {
  if (lyrics.length === 0) {
    return {
      subtitles: [],
      debug: { asrCharCount: 0, lyricCharCount: 0, matchedChars: 0, unmappedLineCount: 0 },
    }
  }

  const lyricChars = flattenLyrics(lyrics)
  const asrChars = flattenAsrWords(asrWords)

  if (asrChars.length === 0 || lyricChars.length === 0) {
    const per = totalDuration / lyrics.length
    return {
      subtitles: lyrics.map((text, i) => ({
        id: uid(),
        start: per * i,
        end: per * (i + 1),
        text,
      })),
      debug: {
        asrCharCount: asrChars.length,
        lyricCharCount: lyricChars.length,
        matchedChars: 0,
        unmappedLineCount: lyrics.length,
      },
    }
  }

  const pairs = alignSequences(asrChars, lyricChars)
  const lyricToAsr: number[] = new Array(lyricChars.length).fill(-1)
  for (const p of pairs) lyricToAsr[p.lyricIdx] = p.asrIdx

  type Slot = { start: number; end: number; mapped: boolean }
  const slots: Slot[] = []

  for (let line = 0; line < lyrics.length; line++) {
    const indices: number[] = []
    for (let i = 0; i < lyricChars.length; i++) {
      if (lyricChars[i].lineIdx === line) indices.push(i)
    }
    if (indices.length === 0) {
      slots.push({ start: -1, end: -1, mapped: false })
      continue
    }

    let firstMapped = -1
    let lastMapped = -1
    for (const i of indices) {
      if (lyricToAsr[i] >= 0) {
        if (firstMapped < 0) firstMapped = lyricToAsr[i]
        lastMapped = lyricToAsr[i]
      }
    }

    if (firstMapped >= 0) {
      slots.push({
        start: asrChars[firstMapped].t,
        end: Math.max(asrChars[firstMapped].t + 0.1, asrChars[lastMapped].tEnd),
        mapped: true,
      })
    } else {
      slots.push({ start: -1, end: -1, mapped: false })
    }
  }

  let unmappedLineCount = 0
  for (let i = 0; i < slots.length; ) {
    if (slots[i].mapped) {
      i++
      continue
    }
    unmappedLineCount++
    let runEnd = i
    while (runEnd < slots.length && !slots[runEnd].mapped) {
      if (runEnd > i) unmappedLineCount++
      runEnd++
    }
    let prevEnd = 0
    for (let k = i - 1; k >= 0; k--) {
      if (slots[k].mapped) {
        prevEnd = slots[k].end
        break
      }
    }
    let nextStart = totalDuration
    if (runEnd < slots.length && slots[runEnd].mapped) {
      nextStart = slots[runEnd].start
    }
    const run = runEnd - i
    const span = Math.max(0.1, nextStart - prevEnd)
    const per = span / run
    for (let k = 0; k < run; k++) {
      slots[i + k] = {
        start: prevEnd + k * per,
        end: prevEnd + (k + 1) * per,
        mapped: false,
      }
    }
    i = runEnd
  }

  for (let i = 1; i < slots.length; i++) {
    if (slots[i].start < slots[i - 1].end - 0.001) {
      slots[i].start = slots[i - 1].end
      if (slots[i].end < slots[i].start + 0.1) slots[i].end = slots[i].start + 0.1
    }
  }

  const subtitles: Subtitle[] = slots.map((s, i) => ({
    id: uid(),
    start: Math.max(0, s.start),
    end: Math.min(totalDuration, s.end),
    text: lyrics[i],
  }))

  return {
    subtitles,
    debug: {
      asrCharCount: asrChars.length,
      lyricCharCount: lyricChars.length,
      matchedChars: pairs.length,
      unmappedLineCount,
    },
  }
}
