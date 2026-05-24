import type { Subtitle, SubtitleStyle, Watermark } from '@/types'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export interface RenderInputs {
  width: number
  height: number
  time: number
  subtitles: Subtitle[]
  style: SubtitleStyle
  watermark: Watermark
  watermarkImage: HTMLImageElement | ImageBitmap | null
}

function findActive(subs: Subtitle[], t: number): Subtitle | null {
  for (const s of subs) {
    if (t >= s.start && t < s.end) return s
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

export function drawSubtitle(ctx: Ctx, input: RenderInputs) {
  const sub = findActive(input.subtitles, input.time)
  if (!sub || !sub.text.trim()) return

  const { width, height, style } = input
  const scale = Math.min(width, height) / 720
  const fontSize = style.fontSize * scale
  ctx.save()
  const fontStyle = style.italic ? 'italic' : 'normal'
  const fontWeight = style.bold ? 'bold' : 'normal'
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${style.fontFamily}`
  ctx.textBaseline = 'middle'

  const maxWidth = width * 0.9
  const lines = wrapLines(ctx, sub.text, maxWidth)
  const lineHeight = fontSize * 1.25
  const blockH = lines.length * lineHeight
  const cy = subtitleY(height, style)
  const padX = fontSize * 0.4
  const padY = fontSize * 0.2

  const marginX = width * 0.05
  let textAlign: 'left' | 'center' | 'right' = 'center'
  let x = width / 2
  switch (style.positionX) {
    case 'left':
      textAlign = 'left'
      x = marginX
      break
    case 'right':
      textAlign = 'right'
      x = width - marginX
      break
    case 'custom':
      textAlign = 'center'
      x = width * style.customX
      break
    default:
      textAlign = 'center'
      x = width / 2
  }
  ctx.textAlign = textAlign

  if (style.background) {
    const widths = lines.map((l) => ctx.measureText(l).width)
    const boxW = Math.max(...widths) + padX * 2
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
    drawVinyl(ctx, watermarkImage as CanvasImageSource, imgW, imgH, cx, cy, totalW / 2)
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
) {
  const labelR = outerR * 0.4

  ctx.fillStyle = '#0a0a0a'
  ctx.beginPath()
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)'
  ctx.lineWidth = Math.max(0.5, outerR * 0.005)
  const grooveCount = 14
  for (let i = 1; i <= grooveCount; i++) {
    const r = labelR + (outerR - labelR) * (i / (grooveCount + 1))
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
  ctx.lineWidth = Math.max(1, outerR * 0.02)
  ctx.beginPath()
  ctx.arc(cx, cy, outerR * 0.88, Math.PI * 1.15, Math.PI * 1.45)
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
  drawSubtitle(ctx, input)
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
