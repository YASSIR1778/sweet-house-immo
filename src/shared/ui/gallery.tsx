import { ChevronLeft, ChevronRight, Expand, Images, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from './base'

export function Lightbox({ images, index, onClose, onIndex, title }: { images: string[]; index: number; onClose: () => void; onIndex: (i: number) => void; title?: string }) {
  const n = images.length
  const prev = useCallback(() => onIndex((index - 1 + n) % n), [index, n, onIndex])
  const next = useCallback(() => onIndex((index + 1) % n), [index, n, onIndex])
  const startX = useRef<number | null>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', h)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', h)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose, prev, next])

  return (
    <div className="anim-fade fixed inset-0 z-[120] flex flex-col bg-navy-950/95 text-white" role="dialog" aria-modal="true" dir="ltr">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-sm text-white/80">
          {title && <span className="me-3 font-semibold text-white">{title}</span>}
          <span className="num">
            {index + 1} / {n}
          </span>
        </div>
        <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="close">
          <X className="size-6" />
        </button>
      </div>
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden px-2"
        onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (startX.current == null) return
          const dx = e.changedTouches[0].clientX - startX.current
          if (dx > 50) prev()
          if (dx < -50) next()
          startX.current = null
        }}
      >
        <img key={images[index]} src={images[index]} alt="" className="anim-fade max-h-full max-w-full rounded-xl object-contain shadow-pop" />
        {n > 1 && (
          <>
            <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 backdrop-blur hover:bg-white/20" aria-label="previous">
              <ChevronLeft className="size-6" />
            </button>
            <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 backdrop-blur hover:bg-white/20" aria-label="next">
              <ChevronRight className="size-6" />
            </button>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
          {images.map((src, i) => (
            <button key={src + i} onClick={() => onIndex(i)} className={cn('h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition', i === index ? 'border-gold' : 'border-transparent opacity-60 hover:opacity-100')}>
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Gallery({ images, title, badges, photosLabel }: { images: string[]; title: string; badges?: React.ReactNode; photosLabel: string }) {
  const [open, setOpen] = useState<number | null>(null)
  const imgs = images.length ? images : ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80']
  const openAt = (i: number) => setOpen(i)
  return (
    <>
      <div className="relative">
        {/* desktop grid */}
        <div className="hidden h-[480px] grid-cols-4 grid-rows-2 gap-3 md:grid">
          <button onClick={() => openAt(0)} className={cn('zoom-img relative overflow-hidden rounded-[18px]', imgs.length > 1 ? 'col-span-2 row-span-2' : 'col-span-4 row-span-2')}>
            <img src={imgs[0]} alt={title} className="h-full w-full object-cover" />
          </button>
          {imgs.slice(1, 5).map((src, i) => (
            <button key={src + i} onClick={() => openAt(i + 1)} className={cn('zoom-img relative overflow-hidden rounded-[18px]', imgs.length === 2 && 'col-span-2 row-span-2', imgs.length === 3 && 'col-span-2', imgs.length === 4 && i === 2 && 'col-span-2')}>
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
              {i === 3 && imgs.length > 5 && (
                <span className="absolute inset-0 flex items-center justify-center bg-navy-950/55 text-lg font-bold text-white">
                  <Images className="me-2 size-5" /> +{imgs.length - 5}
                </span>
              )}
            </button>
          ))}
        </div>
        {/* mobile: snap row */}
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 md:hidden">
          {imgs.map((src, i) => (
            <button key={src + i} onClick={() => openAt(i)} className="h-64 w-[88%] shrink-0 snap-center overflow-hidden rounded-2xl">
              <img src={src} alt="" className="h-full w-full object-cover" loading={i ? 'lazy' : 'eager'} />
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <div className="pointer-events-auto flex flex-wrap gap-2">{badges}</div>
        </div>
        <button onClick={() => openAt(0)} className="absolute bottom-4 end-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-navy shadow backdrop-blur hover:bg-white">
          <Expand className="size-4" /> {photosLabel}
        </button>
      </div>
      {open != null && <Lightbox images={imgs} index={open} onClose={() => setOpen(null)} onIndex={setOpen} title={title} />}
    </>
  )
}
