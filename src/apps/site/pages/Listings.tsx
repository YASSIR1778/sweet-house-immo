import { BellRing, LayoutGrid, Map as MapIcon, SlidersHorizontal, Sun, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PROPERTY_TYPES } from '@/shared/lib/config'
import { usePublicProperties } from '@/shared/lib/data'
import { fmtPriceShort, pick } from '@/shared/lib/format'
import type { Property, PropertyFilter, Purpose } from '@/shared/lib/types'
import { Button, Drawer, EmptyState, Field, Input, Modal, Select, Segmented, cn } from '@/shared/ui/base'
import { PropertyMap } from '@/shared/ui/map'
import { LeadForm, PageHero, PropertyCard, PropertyCardSkeleton, RENT_BUDGETS, SALE_BUDGETS } from '../components'
import { propertyPath, propertyTitle, usePageMeta, useSite } from '../site'

function readFilter(sp: URLSearchParams): PropertyFilter & { view: 'grid' | 'map' } {
  const n = (k: string) => (sp.get(k) ? Number(sp.get(k)) : undefined)
  return {
    purpose: (sp.get('purpose') as Purpose) || '',
    type: (sp.get('type') as PropertyFilter['type']) || '',
    neighborhood: sp.get('hood') || '',
    min_price: n('min'),
    max_price: n('max'),
    rooms: n('rooms'),
    min_area: n('area'),
    q: sp.get('q') || '',
    sort: (sp.get('sort') as PropertyFilter['sort']) || 'newest',
    view: sp.get('view') === 'map' ? 'map' : 'grid',
  }
}

export function applyFilter(list: Property[], f: PropertyFilter): Property[] {
  const out = list.filter((p) => {
    if (f.purpose && p.purpose !== f.purpose) return false
    if (f.type && p.type !== f.type) return false
    if (f.neighborhood && p.neighborhood !== f.neighborhood) return false
    if (f.min_price != null && p.price < f.min_price) return false
    if (f.max_price != null && p.price > f.max_price) return false
    if (f.rooms != null && (p.rooms ?? 0) < f.rooms) return false
    if (f.min_area != null && (p.area ?? p.land_area ?? 0) < f.min_area) return false
    if (f.q) {
      const q = f.q.toLowerCase()
      const hay = `${p.ref} ${p.title} ${p.title_fr ?? ''} ${p.title_es ?? ''} ${p.title_en ?? ''} ${p.description} ${p.city} ${p.address ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
  const rank = (p: Property) => (p.status === 'available' ? 0 : p.status === 'reserved' ? 1 : 2)
  const by: (a: Property, b: Property) => number =
    f.sort === 'price_asc'
      ? (a, b) => a.price - b.price
      : f.sort === 'price_desc'
        ? (a, b) => b.price - a.price
        : f.sort === 'area_desc'
          ? (a, b) => (b.area ?? b.land_area ?? 0) - (a.area ?? a.land_area ?? 0)
          : (a, b) => Number(b.featured) - Number(a.featured) || b.created_at.localeCompare(a.created_at)
  return out.sort((a, b) => rank(a) - rank(b) || by(a, b))
}

function FilterPanel({ f, set, reset, count }: { f: ReturnType<typeof readFilter>; set: (k: string, v: string) => void; reset: () => void; count: number }) {
  const { s, lang, t, typeName } = useSite()
  const budgets = f.purpose === 'rent' ? RENT_BUDGETS : SALE_BUDGETS
  const rent = f.purpose === 'rent'
  return (
    <div className="space-y-4">
      <div>
        <span className="label">{t('list.purpose')}</span>
        <Segmented
          value={(f.purpose || 'all') as 'all' | Purpose}
          onChange={(v) => {
            set('purpose', v === 'all' ? '' : v)
            set('min', '')
            set('max', '')
          }}
          options={[
            { value: 'all', label: t('search.any') },
            { value: 'sale', label: t('p.forSale') },
            { value: 'rent', label: t('p.forRent') },
          ]}
          className="w-full [&>button]:flex-1"
        />
      </div>
      <Field label={t('search.keyword')}>
        <Input value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="SH-1001…" />
      </Field>
      <Field label={t('search.type')}>
        <Select value={f.type} onChange={(e) => set('type', e.target.value)}>
          <option value="">{t('search.any')}</option>
          {PROPERTY_TYPES.map((v) => (
            <option key={v} value={v}>
              {typeName(v)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('search.neighborhood')}>
        <Select value={f.neighborhood} onChange={(e) => set('hood', e.target.value)}>
          <option value="">{t('search.anyNeighborhood')}</option>
          {s.catalog.neighborhoods.map((n) => (
            <option key={n.id} value={n.id}>
              {pick(n.name, lang)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('list.minPrice')}>
          <Select value={f.min_price ?? ''} onChange={(e) => set('min', e.target.value)} className="num">
            <option value="">—</option>
            {budgets.map((b) => (
              <option key={b} value={b}>
                {fmtPriceShort(b, lang)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('list.maxPrice')}>
          <Select value={f.max_price ?? ''} onChange={(e) => set('max', e.target.value)} className="num">
            <option value="">—</option>
            {budgets.map((b) => (
              <option key={b} value={b}>
                {fmtPriceShort(b, lang)}
                {rent ? '/m' : ''}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('list.rooms')}>
          <Select value={f.rooms ?? ''} onChange={(e) => set('rooms', e.target.value)} className="num">
            <option value="">—</option>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}+
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('list.minArea')}>
          <Input type="number" inputMode="numeric" min={0} value={f.min_area ?? ''} onChange={(e) => set('area', e.target.value)} className="num" placeholder="80" />
        </Field>
      </div>
      <div className="flex items-center justify-between pt-2">
        <span className="num text-sm text-muted">{t('list.results', { n: count })}</span>
        <Button variant="ghost" size="sm" onClick={reset} icon={<X className="size-4" />}>
          {t('list.reset')}
        </Button>
      </div>
    </div>
  )
}

export function Listings() {
  const { lang, t, hoodName } = useSite()
  const [sp, setSp] = useSearchParams()
  const f = useMemo(() => readFilter(sp), [sp])
  const { data, isLoading } = usePublicProperties()
  const [drawer, setDrawer] = useState(false)
  const [alert, setAlert] = useState(false)
  const [visible, setVisible] = useState(12)

  const title = f.purpose === 'sale' ? t('list.titleSale') : f.purpose === 'rent' ? t('list.titleRent') : t('list.title')
  usePageMeta(f.purpose ? `${title} — ${t('seo.list')}` : t('seo.list'))

  const list = useMemo(() => applyFilter(data ?? [], f), [data, f])
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(sp)
    if (v) next.set(k, v)
    else next.delete(k)
    setSp(next, { replace: true })
    setVisible(12)
  }
  const reset = () => setSp(new URLSearchParams(f.view === 'map' ? { view: 'map' } : {}), { replace: true })

  const activeChips = [
    f.type && { k: 'type', label: t(`type.${f.type}`) },
    f.neighborhood && { k: 'hood', label: hoodName(f.neighborhood) },
    f.max_price != null && { k: 'max', label: `≤ ${fmtPriceShort(f.max_price, lang)}` },
    f.min_price != null && { k: 'min', label: `≥ ${fmtPriceShort(f.min_price, lang)}` },
    f.rooms != null && { k: 'rooms', label: `${f.rooms}+ ${t('p.rooms')}` },
    f.min_area != null && { k: 'area', label: `≥ ${f.min_area} m²` },
    f.q && { k: 'q', label: `“${f.q}”` },
  ].filter(Boolean) as { k: string; label: string }[]

  const markers = list
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng!, label: fmtPriceShort(p.price, 'fr') + (p.purpose === 'rent' ? '/m' : ''), title: propertyTitle(p, lang), href: `${import.meta.env.BASE_URL.replace(/\/$/, '')}${propertyPath(p)}`, image: p.images[0] }))

  return (
    <>
      <PageHero compact eyebrow={t('nav.properties')} title={title} text={isLoading ? t('common.loading') : t('list.results', { n: list.length })} />

      <div className="mx-auto max-w-7xl px-4 md:px-6">
        {/* toolbar */}
        <div className="sticky top-[64px] z-30 -mx-4 mb-6 flex flex-wrap items-center gap-2 bg-ivory/90 px-4 py-3 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:py-6">
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setDrawer(true)} icon={<SlidersHorizontal className="size-4" />}>
            {t('list.filters')} {activeChips.length ? <span className="num">({activeChips.length})</span> : null}
          </Button>
          <div className="hidden flex-wrap gap-1.5 lg:flex">
            {activeChips.map((c) => (
              <button key={c.k} onClick={() => set(c.k, '')} className="inline-flex items-center gap-1 rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-white">
                {c.label} <X className="size-3" />
              </button>
            ))}
          </div>
          <div className="ms-auto flex items-center gap-2">
            <Select value={f.sort} onChange={(e) => set('sort', e.target.value)} className="h-9 w-auto py-1 text-sm" aria-label={t('list.sort')}>
              {(['newest', 'price_asc', 'price_desc', 'area_desc'] as const).map((v) => (
                <option key={v} value={v}>
                  {t(`list.sort.${v}`)}
                </option>
              ))}
            </Select>
            <Segmented
              value={f.view}
              onChange={(v) => set('view', v === 'grid' ? '' : v)}
              options={[
                { value: 'grid', label: <span className="hidden sm:inline">{t('list.grid')}</span>, icon: <LayoutGrid className="size-4" /> },
                { value: 'map', label: <span className="hidden sm:inline">{t('list.map')}</span>, icon: <MapIcon className="size-4" /> },
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[290px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-[18px] border border-line bg-white p-5 shadow-soft">
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-navy">
                <SlidersHorizontal className="size-4 text-gold-600" /> {t('list.filters')}
              </h2>
              <FilterPanel f={f} set={set} reset={reset} count={list.length} />
            </div>
          </aside>

          <div>
            {f.purpose !== 'sale' && (data ?? []).some((p) => p.seasonal && p.purpose === 'rent') && (
              <Link to="/sejours" className="mb-6 flex items-center gap-3 rounded-[18px] border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-navy transition hover:bg-gold/10">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/20 text-gold-700">
                  <Sun className="size-5" />
                </span>
                <span className="flex-1">{t('list.summer')}</span>
                <span className="font-bold whitespace-nowrap text-gold-700">{t('nav.stays')}</span>
              </Link>
            )}
            {isLoading ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <PropertyCardSkeleton key={i} />
                ))}
              </div>
            ) : list.length === 0 ? (
              <EmptyState
                icon={<BellRing className="size-7" />}
                title={t('list.empty')}
                text={t('list.emptyHint')}
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="gold" onClick={() => setAlert(true)} icon={<BellRing className="size-4" />}>
                      {t('list.alert')}
                    </Button>
                    <Button variant="ghost" onClick={reset}>
                      {t('list.reset')}
                    </Button>
                  </div>
                }
              />
            ) : f.view === 'map' ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
                <div className="order-2 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:order-1 lg:grid-cols-1 xl:grid-cols-2">
                  {list.slice(0, visible).map((p) => (
                    <PropertyCard key={p.id} p={p} compact />
                  ))}
                </div>
                <div className="order-1 lg:order-2">
                  <div className="lg:sticky lg:top-24">
                    <PropertyMap markers={markers} height="min(70vh, 640px)" scrollZoom />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {list.slice(0, visible).map((p) => (
                  <PropertyCard key={p.id} p={p} />
                ))}
              </div>
            )}
            {list.length > visible && (
              <div className="mt-10 text-center">
                <Button variant="outline" size="lg" onClick={() => setVisible((v) => v + 12)}>
                  {t('common.more')} <span className="num text-muted">({list.length - visible})</span>
                </Button>
              </div>
            )}
            {list.length > 0 && (
              <div className={cn('mt-14 rounded-[18px] border border-dashed border-gold/50 bg-gold/5 p-6 text-center')}>
                <p className="text-sm text-muted">{t('list.emptyHint')}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setAlert(true)} icon={<BellRing className="size-4" />}>
                  {t('list.alert')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Drawer open={drawer} onClose={() => setDrawer(false)} title={t('list.filters')} width="max-w-sm">
        <FilterPanel f={f} set={set} reset={reset} count={list.length} />
        <Button variant="gold" size="lg" className="mt-6 w-full" onClick={() => setDrawer(false)}>
          {t('list.apply')} ({list.length})
        </Button>
      </Drawer>

      <Modal open={alert} onClose={() => setAlert(false)} title={t('list.alert')}>
        <LeadForm kind="inquiry" compact buildMeta={() => ({ alert: true, filter: { purpose: f.purpose, type: f.type, neighborhood: f.neighborhood, max_price: f.max_price, min_price: f.min_price, rooms: f.rooms } })} defaultMessage={activeChips.map((c) => c.label).join(' · ')} messageLabel={t('search.keyword')} />
      </Modal>
    </>
  )
}
