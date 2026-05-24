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
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const maxWidth = width * 0.9
  const lines = wrapLines(ctx, sub.text, maxWidth)
  const lineHeight = fontSize * 1.25
  const blockH = lines.length * lineHeight
  const cy = subtitleY(height, style)
  const x = width / 2
  const padX = fontSize * 0.4
  const padY = fontSize * 0.2

  if (style.background) {
    const widths = lines.map((l) => ctx.measureText(l).width)
    const boxW = Math.max(...widths) + padX * 2
    const boxH = blockH + padY * 2
    ctx.fillStyle = hexToRgba(style.backgroundColor, style.backgroundOpacity)
    ctx.fillRect(x - boxW / 2, cy - blockH / 2 - padY, boxW, boxH)
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
      const left = x - lineWidth / 2
      const right = x + lineWidth / 2
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
  const { watermark, watermarkImage, width, height } = input
  if (!watermark.imageDataUrl || !watermarkImage) return
  const imgW = 'width' in watermarkImage ? watermarkImage.width : 0
  const imgH = 'height' in watermarkImage ? watermarkImage.height : 0
  if (!imgW || !imgH) return

  const targetW = width * watermark.width
  const targetH = (imgH / imgW) * targetW
  const mx = width * watermark.marginX
  const my = height * watermark.marginY

  let x = 0
  let y = 0
  switch (watermark.position) {
    case 'top-left': x = mx; y = my; break
    case 'top': x = (width - targetW) / 2; y = my; break
    case 'top-right': x = width - targetW - mx; y = my; break
    case 'left': x = mx; y = (height - targetH) / 2; break
    case 'center': x = (width - targetW) / 2; y = (height - targetH) / 2; break
    case 'right': x = width - targetW - mx; y = (height - targetH) / 2; break
    case 'bottom-left': x = mx; y = height - targetH - my; break
    case 'bottom': x = (width - targetW) / 2; y = height - targetH - my; break
    case 'bottom-right': x = width - targetW - mx; y = height - targetH - my; break
  }

  ctx.save()
  ctx.globalAlpha = watermark.opacity
  ctx.drawImage(watermarkImage as CanvasImageSource, x, y, targetW, targetH)
  ctx.restore()
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
