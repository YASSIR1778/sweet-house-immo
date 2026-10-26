/*
 * Ready-to-post picture of a property, drawn in the browser: the photo, a «for sale» badge,
 * the price, the main figures and the agency's name and phone. Post 4:5, story 9:16, square.
 */

export type SocialFormat = 'post' | 'story' | 'square'
export const FORMAT_SIZE: Record<SocialFormat, [number, number]> = { post: [1080, 1350], story: [1080, 1920], square: [1080, 1080] }

export interface SocialCard {
  image: string | null
  badge: string
  ref: string
  title: string
  place: string
  price: string
  specs: string[]
  agency: string
  phone: string
  rtl: boolean
}

const NAVY = '#0b1b33'
const GOLD = '#c9a24b'
const FONT = '"IBM Plex Sans Arabic", "Inter", sans-serif'

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    // without CORS the canvas could not be saved; such a photo is replaced by the brand background
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** Like CSS object-fit: cover. */
function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const r = Math.max(w / img.width, h / img.height)
  const sw = w / r
  const sh = h / r
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Word wrap on the measured width; the last line ends with «…» when the text is longer. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, lines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const out: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (ctx.measureText(next).width <= max) cur = next
    else {
      if (cur) out.push(cur)
      cur = w
      if (out.length === lines) break
    }
  }
  if (cur && out.length < lines) out.push(cur)
  if (out.length === lines && words.join(' ') !== out.join(' ')) {
    let last = out[lines - 1]
    while (last && ctx.measureText(`${last}…`).width > max) last = last.slice(0, -1)
    out[lines - 1] = `${last.trim()}…`
  }
  return out
}

/** The agency mark (arch + door), as in the printed documents. */
function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s / 64, s / 64)
  roundRect(ctx, 0, 0, 64, 64, 16)
  ctx.fillStyle = NAVY
  ctx.fill()
  ctx.strokeStyle = GOLD
  ctx.lineCap = 'round'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(14, 50)
  ctx.lineTo(14, 30)
  ctx.arc(32, 30, 18, Math.PI, 0)
  ctx.lineTo(50, 50)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(12, 50)
  ctx.lineTo(52, 50)
  ctx.stroke()
  ctx.fillStyle = GOLD
  ctx.fillRect(29, 40, 6, 8)
  ctx.restore()
}

export async function drawSocialCard(canvas: HTMLCanvasElement, d: SocialCard, format: SocialFormat) {
  const [W, H] = FORMAT_SIZE[format]
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  await Promise.all([document.fonts.load(`700 64px ${FONT}`), document.fonts.load(`500 32px ${FONT}`)]).catch(() => undefined)
  const pad = 64
  const photoH = Math.round(H * (format === 'story' ? 0.6 : format === 'square' ? 0.56 : 0.62))
  const img = d.image ? await loadImage(d.image) : null

  // photo (or the brand background)
  ctx.fillStyle = NAVY
  ctx.fillRect(0, 0, W, H)
  if (img) cover(ctx, img, 0, 0, W, photoH + 60)
  else {
    const g = ctx.createLinearGradient(0, 0, W, photoH)
    g.addColorStop(0, '#13284a')
    g.addColorStop(1, NAVY)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, photoH + 60)
    drawMark(ctx, W / 2 - 110, photoH / 2 - 130, 220)
  }
  const shade = ctx.createLinearGradient(0, 0, 0, 260)
  shade.addColorStop(0, 'rgba(6,13,27,0.55)')
  shade.addColorStop(1, 'rgba(6,13,27,0)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, W, 260)

  ctx.direction = d.rtl ? 'rtl' : 'ltr'
  const start = d.rtl ? W - pad : pad
  const align: CanvasTextAlign = d.rtl ? 'right' : 'left'

  // badge and reference
  ctx.font = `700 40px ${FONT}`
  const bw = ctx.measureText(d.badge).width + 56
  const bx = d.rtl ? W - pad - bw : pad
  roundRect(ctx, bx, pad, bw, 76, 38)
  ctx.fillStyle = GOLD
  ctx.fill()
  ctx.fillStyle = '#060d1b'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(d.badge, bx + bw / 2, pad + 39)
  ctx.font = `600 32px Inter, sans-serif`
  ctx.direction = 'ltr'
  const rw = ctx.measureText(d.ref).width + 44
  const rx = d.rtl ? bx - rw - 16 : bx + bw + 16
  roundRect(ctx, rx, pad + 8, rw, 60, 30)
  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.fill()
  ctx.fillStyle = NAVY
  ctx.fillText(d.ref, rx + rw / 2, pad + 39)
  ctx.direction = d.rtl ? 'rtl' : 'ltr'

  // panel
  const top = photoH - 20
  roundRect(ctx, 0, top, W, H - top + 60, 48)
  ctx.fillStyle = NAVY
  ctx.fill()
  ctx.fillStyle = GOLD
  ctx.fillRect(d.rtl ? W - pad - 120 : pad, top + 44, 120, 6)

  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  let y = top + 140
  ctx.font = `800 ${format === 'square' ? 76 : 88}px ${FONT}`
  ctx.fillStyle = GOLD
  ctx.fillText(d.price, start, y)

  y += format === 'square' ? 64 : 80
  ctx.font = `700 ${format === 'square' ? 40 : 46}px ${FONT}`
  ctx.fillStyle = '#ffffff'
  for (const line of wrap(ctx, d.title, W - pad * 2, 2)) {
    ctx.fillText(line, start, y)
    y += format === 'square' ? 52 : 60
  }
  ctx.font = `500 34px ${FONT}`
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.fillText(`⌖ ${d.place}`, start, y + 4)
  y += 64

  // figures
  ctx.font = `600 32px ${FONT}`
  let x = start
  for (const sp of d.specs.slice(0, 3)) {
    const w = ctx.measureText(sp).width + 44
    const cx = d.rtl ? x - w : x
    roundRect(ctx, cx, y, w, 62, 31)
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.fillText(sp, cx + w / 2, y + 42)
    x = d.rtl ? cx - 14 : cx + w + 14
  }
  ctx.textAlign = align

  // agency
  const fy = H - pad - 20
  drawMark(ctx, d.rtl ? W - pad - 84 : pad, fy - 70, 84)
  const tx = d.rtl ? W - pad - 108 : pad + 108
  ctx.font = `700 36px ${FONT}`
  ctx.fillStyle = GOLD
  ctx.fillText(d.agency, tx, fy - 30)
  ctx.font = `600 34px Inter, sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.direction = 'ltr'
  ctx.textAlign = d.rtl ? 'right' : 'left'
  ctx.fillText(d.phone, tx, fy + 14)
}

export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob(resolve, 'image/png')
    } catch {
      resolve(null)
    }
  })
}
