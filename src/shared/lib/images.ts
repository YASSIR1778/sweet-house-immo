/** Resize a picture in the browser before upload (saves storage & bandwidth), with an optional mark. */
export async function resizeImage(file: File, maxSide = 1600, quality = 0.82, watermark?: string): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('not an image')
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  if (watermark) drawWatermark(ctx, w, h, watermark)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
  return blob ?? file
}

/** The agency's name in the bottom corner, light enough not to hide the room. */
function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number, text: string) {
  const size = Math.max(16, Math.round(Math.min(w, h) * 0.035))
  ctx.save()
  ctx.font = `700 ${size}px "IBM Plex Sans Arabic", "Inter", sans-serif`
  ctx.textBaseline = 'bottom'
  ctx.textAlign = 'right'
  ctx.direction = 'rtl'
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = Math.round(size / 3)
  ctx.fillStyle = 'rgba(255,255,255,0.78)'
  ctx.fillText(text, w - size, h - size * 0.8)
  ctx.restore()
}

export function isDataUrl(u: string) {
  return u.startsWith('data:')
}
