import type { Subtitle, SubtitleStyle, TextStyleCore, Track, Watermark } from '@/types'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export interface RenderInputs {
  width: number
  height: number
  time: number
  tracks: Track[]
  watermark: Watermark
  watermarkImage: HTMLImageElement | ImageBitmap | null
}

function findActive(cues: Subtitle[], t: number): Subtitle | null {
  for (const c of cues) {
    if (t >= c.start && t < c.end) return c
  }
  return null
}

function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function subtitleY(height: number, style: SubtitleStyle): number {
  switch (style.position) {
    case 'top':
      return height * 0.12
    case 'middle':
      return height * 0.5
    case 'bottom':
      return height * 0.88
    case 'custom':
      return height * style.customY
  }
}

function wrapLines(ctx: Ctx, text: string, maxWidth: number): string[] {
  const result: string[] = []
  for (const rawLine of text.split('\n')) {
    if (!rawLine) {
      result.push('')
      continue
    }
    const words = rawLine.split(/(\s+)/)
    let current = ''
    for (const w of words) {
      const next = current + w
      if (ctx.measureText(next).width <= maxWidth || current === '') {
        current = next
      } else {
        result.push(current.trimEnd())
        current = w.trimStart()
      }
    }
    if (current) result.push(current)
  }
  return result
}

function setFont(ctx: Ctx, style: TextStyleCore, fontSize: number) {
  const fontStyle = style.italic ? 'italic' : 'normal'
  const fontWeight = style.bold ? 'bold' : 'normal'
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${style.fontFamily}`
}

interface PaintTextOpts {
  text: string
  /** Anchor x in canvas px (meaning depends on align). */
  cx: number
  /** Vertical center of the text block in canvas px. */
  cy: number
  align: 'left' | 'center' | 'right'
  maxWidth: number
  scale: number
  /** Clockwise rotation in degrees, around the text block center. */
  rotation?: number
  style: TextStyleCore
}

/** Shared text painter used by every track (subtitles and label-like cues). */
function paintText(ctx: Ctx, o: PaintTextOpts) {
  const { style, scale } = o
  const fontSize = style.fontSize * scale
  ctx.save()
  setFont(ctx, style, fontSize)
  ctx.textBaseline = 'middle'

  const lines = wrapLines(ctx, o.text, o.maxWidth)
  const lineHeight = fontSize * 1.25
  const blockH = lines.length * lineHeight
  const cy = o.cy
  const padX = fontSize * 0.4
  const padY = fontSize * 0.2

  const textAlign = o.align
  const x = o.cx
  ctx.textAlign = textAlign

  let maxLineW = 0
  for (const l of lines) maxLineW = Math.max(maxLineW, ctx.measureText(l).width)

  // Rotate around the block's visual center.
  const rot = ((o.rotation ?? 0) * Math.PI) / 180
  if (rot) {
    const pivotX =
      textAlign === 'left' ? x + maxLineW / 2 : textAlign === 'right' ? x - maxLineW / 2 : x
    ctx.translate(pivotX, cy)
    ctx.rotate(rot)
    ctx.translate(-pivotX, -cy)
  }

  if (style.background) {
    const boxW = maxLineW + padX * 2
    const boxH = blockH + padY * 2
    let boxX: number
    if (textAlign === 'left') boxX = x - padX
    else if (textAlign === 'right') boxX = x - boxW + padX
    else boxX = x - boxW / 2
    const boxY = cy - blockH / 2 - padY
    ctx.fillStyle = hexToRgba(style.backgroundColor, style.backgroundOpacity)
    const radius = Math.min(boxH / 2, boxW / 2, style.backgroundRadius * fontSize)
    if (radius > 0 && typeof (ctx as CanvasRenderingContext2D).roundRect === 'function') {
      ctx.beginPath()
      ;(ctx as CanvasRenderingContext2D).roundRect(boxX, boxY, boxW, boxH, radius)
      ctx.fill()
    } else {
      ctx.fillRect(boxX, boxY, boxW, boxH)
    }
  }

  const strokeW = style.strokeWidth * scale
  const decoThickness = Math.max(1, fontSize * 0.06)
  for (let i = 0; i < lines.length; i++) {
    const ly = cy - blockH / 2 + lineHeight * (i + 0.5)
    if (strokeW > 0) {
      ctx.lineJoin = 'round'
      ctx.miterLimit = 2
      ctx.lineWidth = strokeW
      ctx.strokeStyle = style.strokeColor
      ctx.strokeText(lines[i], x, ly)
    }
    ctx.fillStyle = style.color
    ctx.fillText(lines[i], x, ly)

    if (style.underline || style.strikethrough) {
      const lineWidth = ctx.measureText(lines[i]).width
      let left: number
      let right: number
      if (textAlign === 'left') {
        left = x
        right = x + lineWidth
      } else if (textAlign === 'right') {
        left = x - lineWidth
        right = x
      } else {
        left = x - lineWidth / 2
        right = x + lineWidth / 2
      }
      ctx.save()
      ctx.lineWidth = decoThickness
      ctx.strokeStyle = style.color
      ctx.lineCap = 'butt'
      if (style.strikethrough) {
        ctx.beginPath()
        ctx.moveTo(left, ly)
        ctx.lineTo(right, ly)
        ctx.stroke()
      }
      if (style.underline) {
        const uy = ly + fontSize * 0.42
        ctx.beginPath()
        ctx.moveTo(left, uy)
        ctx.lineTo(right, uy)
        ctx.stroke()
      }
      ctx.restore()
    }
  }
  ctx.restore()
}

export interface TrackAnchor {
  /** Horizontal anchor in canvas px (its meaning depends on align). */
  cx: number
  /** Vertical block center in canvas px. */
  cy: number
  align: 'left' | 'center' | 'right'
  maxWidth: number
}

/** Resolve a track's placement into canvas-space anchor + wrap width. */
export function trackAnchor(track: SubtitleStyle, width: number, height: number): TrackAnchor {
  const cy = subtitleY(height, track)
  const marginX = width * 0.05
  let align: 'left' | 'center' | 'right' = 'center'
  let cx = width / 2
  switch (track.positionX) {
    case 'left':
      align = 'left'
      cx = marginX
      break
    case 'right':
      align = 'right'
      cx = width - marginX
      break
    case 'custom':
      align = 'center'
      cx = width * track.customX
      break
    default:
      align = 'center'
      cx = width / 2
  }
  // Freely-placed (custom) tracks behave like labels: wrap only on explicit \n.
  const maxWidth = track.position === 'custom' || track.positionX === 'custom' ? Infinity : width * 0.9
  return { cx, cy, align, maxWidth }
}

export function drawTracks(ctx: Ctx, input: RenderInputs) {
  const { width, height, tracks, time } = input
  const renderScale = Math.min(width, height) / 720
  for (const track of tracks) {
    const cue = findActive(track.cues, time)
    if (!cue || !cue.text.trim()) continue
    const { cx, cy, align, maxWidth } = trackAnchor(track, width, height)
    paintText(ctx, {
      text: cue.text,
      cx,
      cy,
      align,
      maxWidth,
      scale: renderScale,
      rotation: track.rotation,
      style: track,
    })
  }
}

/**
 * Bounding box (pre-rotation) of a track cue's text block in canvas pixels,
 * used to position the draggable hit target in the preview overlay. Mirrors
 * paintText's metrics, including the track's scale.
 */
export function measureTrackBox(
  ctx: Ctx,
  track: Track,
  text: string,
  width: number,
  height: number,
): { w: number; h: number } {
  const fontSize = track.fontSize * (Math.min(width, height) / 720)
  const { maxWidth } = trackAnchor(track, width, height)
  ctx.save()
  setFont(ctx, track, fontSize)
  const lines = wrapLines(ctx, text || ' ', maxWidth)
  let maxW = 0
  for (const l of lines) maxW = Math.max(maxW, ctx.measureText(l || ' ').width)
  ctx.restore()
  const lineHeight = fontSize * 1.25
  const padX = fontSize * 0.4
  const padY = fontSize * 0.2
  return { w: maxW + padX * 2, h: lines.length * lineHeight + padY * 2 }
}

export function drawWatermark(ctx: Ctx, input: RenderInputs) {
  const { watermark, watermarkImage, width, height, time } = input
  if (!watermark.imageDataUrl || !watermarkImage) return
  const imgW = 'width' in watermarkImage ? watermarkImage.width : 0
  const imgH = 'height' in watermarkImage ? watermarkImage.height : 0
  if (!imgW || !imgH) return

  const isCircle = watermark.shape === 'circle' || watermark.vinyl
  const userSize = width * watermark.width
  let totalW: number, totalH: number
  if (isCircle) {
    totalW = totalH = userSize
  } else {
    totalW = userSize
    totalH = (imgH / imgW) * userSize
  }

  const mx = width * watermark.marginX
  const my = height * watermark.marginY
  let bx = 0
  let by = 0
  switch (watermark.position) {
    case 'top-left': bx = mx; by = my; break
    case 'top': bx = (width - totalW) / 2; by = my; break
    case 'top-right': bx = width - totalW - mx; by = my; break
    case 'left': bx = mx; by = (height - totalH) / 2; break
    case 'center': bx = (width - totalW) / 2; by = (height - totalH) / 2; break
    case 'right': bx = width - totalW - mx; by = (height - totalH) / 2; break
    case 'bottom-left': bx = mx; by = height - totalH - my; break
    case 'bottom': bx = (width - totalW) / 2; by = height - totalH - my; break
    case 'bottom-right': bx = width - totalW - mx; by = height - totalH - my; break
  }

  const cx = bx + totalW / 2
  const cy = by + totalH / 2

  ctx.save()
  ctx.globalAlpha = watermark.opacity

  if (watermark.rotateRpm > 0) {
    const angle = (time * watermark.rotateRpm / 60) * Math.PI * 2
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    ctx.translate(-cx, -cy)
  }

  if (watermark.vinyl) {
    drawVinyl(
      ctx,
      watermarkImage as CanvasImageSource,
      imgW,
      imgH,
      cx,
      cy,
      totalW / 2,
      watermark.vinylThickness,
    )
  } else if (isCircle) {
    drawCircleImage(ctx, watermarkImage as CanvasImageSource, imgW, imgH, cx, cy, totalW / 2)
  } else {
    ctx.drawImage(watermarkImage as CanvasImageSource, bx, by, totalW, totalH)
  }

  ctx.restore()
}

function drawCircleImage(
  ctx: Ctx,
  img: CanvasImageSource,
  imgW: number,
  imgH: number,
  cx: number,
  cy: number,
  r: number,
) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  const aspect = imgW / imgH
  let drawW: number, drawH: number
  if (aspect > 1) {
    drawH = r * 2
    drawW = drawH * aspect
  } else {
    drawW = r * 2
    drawH = drawW / aspect
  }
  ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH)
  ctx.restore()
}

function drawVinyl(
  ctx: Ctx,
  img: CanvasImageSource,
  imgW: number,
  imgH: number,
  cx: number,
  cy: number,
  outerR: number,
  thickness: number,
) {
  const t = Math.min(1, Math.max(0, thickness))
  const labelR = outerR * (0.85 - t * 0.65)

  ctx.fillStyle = '#0a0a0a'
  ctx.beginPath()
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
  ctx.fill()

  const ringSpan = outerR - labelR
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)'
  ctx.lineWidth = Math.max(0.5, outerR * 0.005)
  const grooveCount = Math.max(2, Math.round(14 * (ringSpan / outerR)))
  for (let i = 1; i <= grooveCount; i++) {
    const r = labelR + ringSpan * (i / (grooveCount + 1))
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
  ctx.lineWidth = Math.max(1, outerR * 0.02)
  ctx.beginPath()
  ctx.arc(cx, cy, labelR + ringSpan * 0.7, Math.PI * 1.15, Math.PI * 1.45)
  ctx.stroke()

  drawCircleImage(ctx, img, imgW, imgH, cx, cy, labelR)

  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.arc(cx, cy, outerR * 0.02, 0, Math.PI * 2)
  ctx.fill()
}

export function renderFrame(ctx: Ctx, input: RenderInputs, clear = true) {
  if (clear) ctx.clearRect(0, 0, input.width, input.height)
  drawWatermark(ctx, input)
  drawTracks(ctx, input)
}

export function loadWatermarkImage(dataUrl: string | null): Promise<HTMLImageElement | null> {
  if (!dataUrl) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}
