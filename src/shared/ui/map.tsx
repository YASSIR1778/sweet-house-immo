import L from 'leaflet'
import { useEffect, useRef } from 'react'
import { cn } from './base'

export interface MapMarker {
  id: string
  lat: number
  lng: number
  label?: string
  title?: string
  href?: string
  image?: string
}

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const TETOUAN: [number, number] = [35.5785, -5.3684]

const PIN = L.divIcon({
  className: '',
  html: `<svg width="36" height="46" viewBox="0 0 36 46" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 6px 10px rgba(11,27,51,.35))"><path d="M18 1C8.6 1 1 8.5 1 17.8 1 30 18 45 18 45s17-15 17-27.2C35 8.5 27.4 1 18 1z" fill="#0b1b33" stroke="#c9a24b" stroke-width="2"/><circle cx="18" cy="18" r="6" fill="#c9a24b"/></svg>`,
  iconSize: [36, 46],
  iconAnchor: [18, 45],
  popupAnchor: [0, -40],
})

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Creates the Leaflet map once and keeps its size in sync with the container. */
function useLeafletMap(el: React.RefObject<HTMLDivElement | null>, opts: { center?: [number, number]; zoom?: number; scrollZoom?: boolean }) {
  const map = useRef<L.Map | null>(null)
  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { scrollWheelZoom: Boolean(opts.scrollZoom), zoomControl: true, attributionControl: true })
    L.tileLayer(TILES, { attribution: ATTR, maxZoom: 19 }).addTo(m)
    m.setView(opts.center ?? TETOUAN, opts.zoom ?? 12)
    map.current = m
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current)
    return () => {
      ro.disconnect()
      m.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return map
}

export function PropertyMap({
  markers,
  center,
  zoom,
  className,
  height = 360,
  fit = true,
  onSelect,
  scrollZoom = false,
}: {
  markers: MapMarker[]
  center?: [number, number]
  zoom?: number
  className?: string
  height?: number | string
  fit?: boolean
  onSelect?: (id: string) => void
  scrollZoom?: boolean
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useLeafletMap(el, { center, zoom, scrollZoom })
  const layer = useRef<L.LayerGroup | null>(null)
  const latest = useRef({ markers, onSelect })
  useEffect(() => {
    latest.current = { markers, onSelect }
  })

  // Redraw only when the markers really change (not on every parent render).
  const key = JSON.stringify(markers.map((m) => [m.id, m.lat, m.lng, m.label ?? '', m.title ?? '']))
  const cLat = center?.[0]
  const cLng = center?.[1]

  useEffect(() => {
    const m = map.current
    if (!m) return
    if (!layer.current || !m.hasLayer(layer.current)) layer.current = L.layerGroup().addTo(m)
    const g = layer.current
    g.clearLayers()
    const pts: L.LatLngExpression[] = []
    for (const mk of latest.current.markers) {
      if (mk.lat == null || mk.lng == null) continue
      pts.push([mk.lat, mk.lng])
      const icon = mk.label ? L.divIcon({ className: '', html: `<div class="price-marker">${esc(mk.label)}</div>`, iconSize: [0, 0], iconAnchor: [0, 0] }) : PIN
      const marker = L.marker([mk.lat, mk.lng], { icon, title: mk.title }).addTo(g)
      if (mk.title) {
        const img = mk.image ? `<img src="${esc(mk.image)}" alt="" style="width:100%;height:90px;object-fit:cover;border-radius:10px;margin-bottom:6px"/>` : ''
        const link = mk.href ? `<a href="${esc(mk.href)}" style="color:#0b1b33;font-weight:700;text-decoration:none">${esc(mk.title)}</a>` : `<b>${esc(mk.title)}</b>`
        marker.bindPopup(`<div style="min-width:180px;max-width:220px">${img}${link}</div>`)
      }
      marker.on('click', () => latest.current.onSelect?.(mk.id))
    }
    if (fit && pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15, animate: false })
    else if (pts.length === 1) m.setView(pts[0], zoom ?? 15, { animate: false })
    else if (cLat != null && cLng != null) m.setView([cLat, cLng], zoom ?? 12, { animate: false })
  }, [map, key, fit, zoom, cLat, cLng])

  return <div ref={el} dir="ltr" className={cn('z-0 w-full overflow-hidden rounded-[18px] border border-line', className)} style={{ height }} />
}

/** Click (or drag the pin) to choose a position. */
export function LocationPicker({ lat, lng, onChange, height = 320, fallback, className }: { lat: number | null; lng: number | null; onChange: (lat: number, lng: number) => void; height?: number; fallback?: [number, number]; className?: string }) {
  const el = useRef<HTMLDivElement>(null)
  const start: [number, number] = lat != null && lng != null ? [lat, lng] : (fallback ?? TETOUAN)
  const map = useLeafletMap(el, { center: start, zoom: lat != null ? 16 : 13, scrollZoom: true })
  const marker = useRef<L.Marker | null>(null)
  const cb = useRef(onChange)
  useEffect(() => {
    cb.current = onChange
  })

  useEffect(() => {
    const m = map.current
    if (!m) return
    const round = (n: number) => Math.round(n * 1e6) / 1e6
    const place = (ll: L.LatLng) => {
      if (!marker.current || !m.hasLayer(marker.current)) {
        marker.current = L.marker(ll, { icon: PIN, draggable: true }).addTo(m)
        marker.current.on('dragend', () => {
          const p = marker.current!.getLatLng()
          cb.current(round(p.lat), round(p.lng))
        })
      } else marker.current.setLatLng(ll)
    }
    const onClick = (e: L.LeafletMouseEvent) => {
      place(e.latlng)
      cb.current(round(e.latlng.lat), round(e.latlng.lng))
    }
    m.on('click', onClick)
    return () => {
      m.off('click', onClick)
    }
  }, [map])

  // follow external changes (e.g. "use the neighbourhood centre")
  useEffect(() => {
    const m = map.current
    if (!m || lat == null || lng == null) return
    const ll = L.latLng(lat, lng)
    if (!marker.current || !m.hasLayer(marker.current)) {
      marker.current = L.marker(ll, { icon: PIN, draggable: true }).addTo(m)
      marker.current.on('dragend', () => {
        const p = marker.current!.getLatLng()
        cb.current(Math.round(p.lat * 1e6) / 1e6, Math.round(p.lng * 1e6) / 1e6)
      })
    } else if (!marker.current.getLatLng().equals(ll)) marker.current.setLatLng(ll)
    if (!m.getBounds().pad(-0.2).contains(ll)) m.setView(ll, Math.max(m.getZoom(), 15), { animate: false })
  }, [map, lat, lng])

  return <div ref={el} dir="ltr" className={cn('z-0 w-full cursor-crosshair overflow-hidden rounded-[18px] border border-line', className)} style={{ height }} />
}
