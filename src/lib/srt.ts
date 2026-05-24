import type { Subtitle } from '@/types'
import { uid } from '@/lib/utils'

const TS_RE =
  /(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})/

function tsToSeconds(h: string, m: string, s: string, ms: string): number {
  return parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10) + parseInt(ms.padEnd(3, '0'), 10) / 1000
}

function stripVttTags(line: string): string {
  return line.replace(/<\/?[^>]+>/g, '').replace(/\{[^}]+\}/g, '')
}

export function parseSubtitles(content: string): Subtitle[] {
  const text = content.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = text.split('\n')
  const cues: Subtitle[] = []
  let i = 0

  if (lines[0]?.trim().toUpperCase().startsWith('WEBVTT')) i = 1

  while (i < lines.length) {
    const line = lines[i]
    const m = line.match(TS_RE)
    if (!m) {
      i++
      continue
    }
    const start = tsToSeconds(m[1], m[2], m[3], m[4])
    const end = tsToSeconds(m[5], m[6], m[7], m[8])
    i++
    const textLines: string[] = []
    while (i < lines.length && lines[i].trim() !== '') {
      if (lines[i].match(TS_RE)) break
      textLines.push(stripVttTags(lines[i]))
      i++
    }
    const cueText = textLines.join('\n').trim()
    if (end > start && cueText) {
      cues.push({ id: uid(), start, end, text: cueText })
    }
  }

  return cues.sort((a, b) => a.start - b.start)
}
