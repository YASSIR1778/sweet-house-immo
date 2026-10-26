import { Building2, Copy, CopyPlus, ExternalLink, Eye, EyeOff, LayoutGrid, List, Pencil, Plus, Printer, Star, StarOff, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { PROPERTY_TYPES, SITE_URL } from '@/shared/lib/config'
import { useTable } from '@/shared/lib/data'
import { download, fmtDate, fmtNumber, fmtPrice, nowIso, toCsv, uid } from '@/shared/lib/format'
import { repo } from '@/shared/lib/repo'
import type { Property, PropertyStatus, Purpose } from '@/shared/lib/types'
import { ButtonLink, EmptyState, Segmented, Select, Switch, cn } from '@/shared/ui/base'
import { WhatsAppIcon } from '@/shared/ui/icons'
import { BulkBar, CheckAll, CheckCell, bulkBtn, useBulkDelete, useBulkSave, useSelection } from '../bulk'
import { nextRef, useCan, useDeleteRow, useNames, useSave } from '../hooks'
import { PROPERTY_STATUS, PURPOSE } from '../labels'
import { printPropertySheet } from '../print'
import { propertyMessage } from '../templates'
import { DropMenu, PageHeader, Pill, SearchBox, Tabs, type MenuItem } from '../ui'

type Tab = 'all' | 'live' | 'hidden' | 'reserved' | 'closed'

function readView(): 'table' | 'grid' {
  try {
    return localStorage.getItem('shi:props-view') === 'grid' ? 'grid' : 'table'
  } catch {
    return 'table'
  }
}

export function Properties() {
  const can = useCan()
  const canEdit = can('properties')
  const nav = useNavigate()
  const { data = [], isLoading } = useTable<Property>('properties')
  const { s, hoodName, typeName } = useNames()
  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState('')
  const [purpose, setPurpose] = useState<'' | Purpose>('')
  const [type, setType] = useState('')
  const [sort, setSort] = useState<'updated' | 'price_desc' | 'price_asc' | 'views'>('updated')
  const [view, setViewState] = useState<'table' | 'grid'>(readView)
  const setView = (v: 'table' | 'grid') => {
    setViewState(v)
    try {
      localStorage.setItem('shi:props-view', v)
    } catch {
      /* ignore */
    }
  }
  const { save } = useSave<Property>('properties', 'property', (p) => `${p.ref} — ${p.title}`)
  const del = useDeleteRow('properties', 'property')

  const inTab = (p: Property, t: Tab) =>
    t === 'all' ||
    (t === 'live' && p.published && p.status === 'available') ||
    (t === 'hidden' && (!p.published || p.status === 'draft') && !['sold', 'rented'].includes(p.status)) ||
    (t === 'reserved' && p.status === 'reserved') ||
    (t === 'closed' && (p.status === 'sold' || p.status === 'rented'))

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    const out = data.filter(
      (p) =>
        inTab(p, tab) &&
        (!purpose || p.purpose === purpose) &&
        (!type || p.type === type) &&
        (!term || `${p.ref} ${p.title} ${p.title_fr ?? ''} ${hoodName(p.neighborhood)} ${p.city} ${p.address ?? ''}`.toLowerCase().includes(term)),
    )
    return out.sort((a, b) =>
      sort === 'price_desc' ? b.price - a.price : sort === 'price_asc' ? a.price - b.price : sort === 'views' ? b.views - a.views : b.updated_at.localeCompare(a.updated_at),
    )
  }, [data, tab, q, purpose, type, sort, hoodName])

  const count = (t: Tab) => data.filter((p) => inTab(p, t)).length
  const ids = useMemo(() => list.map((p) => p.id), [list])
  const selection = useSelection(ids)
  const picked = list.filter((p) => selection.isSelected(p.id))
  const bulkSave = useBulkSave<Property>('properties', 'property')
  const bulkDelete = useBulkDelete<Property>('properties', 'property', (p) => p.ref)
  const selectable = canEdit || can('delete') || can('export')
  const bulk = async (rows: Property[], message: string) => {
    await bulkSave(rows.map((p) => ({ ...p, updated_at: nowIso() })), message)
    selection.clear()
  }
  const exportPicked = () =>
    download(
      `properties-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(picked.map((p) => ({ المرجع: p.ref, العنوان: p.title, الغرض: PURPOSE[p.purpose].label, الثمن: p.price, المساحة: p.area, الحي: hoodName(p.neighborhood), الحالة: PROPERTY_STATUS[p.status].label, منشور: p.published ? 'نعم' : 'لا', المشاهدات: p.views }))),
      'text/csv;charset=utf-8',
    )

  const togglePublish = (p: Property) =>
    save({ ...p, published: !p.published, status: p.status === 'draft' && !p.published ? 'available' : p.status, updated_at: nowIso() }, { action: 'status', meta: { published: !p.published }, message: p.published ? 'أُخفي العقار من الموقع' : 'نُشر العقار على الموقع ✓' })
  const setStatus = (p: Property, status: PropertyStatus) => save({ ...p, status, updated_at: nowIso() }, { action: 'status', meta: { status }, message: `الحالة: ${PROPERTY_STATUS[status].label}` })
  const duplicate = async (p: Property) => {
    const copy: Property = { ...p, id: uid(), ref: nextRef(data, s.catalog.ref_prefix), title: `${p.title} (نسخة)`, published: false, featured: false, status: 'draft', views: 0, created_at: nowIso(), updated_at: nowIso() }
    const saved = await save(copy, { isNew: true, message: `تم إنشاء نسخة ${copy.ref}` })
    if (saved) nav(`/admin/properties/${copy.id}`)
  }
  const remove = async (p: Property) => {
    if (await del(p.id, `${p.ref} — ${p.title}`, { text: 'سيُحذف العقار وصوره نهائياً. إن كان قد بيع فالأفضل تغيير حالته إلى «مُباع» للاحتفاظ بالسجل.' })) {
      for (const img of p.images) void repo.deleteImage(img)
    }
  }
  const copyLink = async (p: Property) => {
    try {
      await navigator.clipboard.writeText(`${SITE_URL}/biens/${p.ref}`)
      toast.success('تم نسخ الرابط')
    } catch {
      toast.error('تعذر النسخ')
    }
  }

  const menu = (p: Property): MenuItem[] => [
    { label: 'تعديل', icon: <Pencil className="size-4" />, onClick: () => nav(`/admin/properties/${p.id}`) },
    { label: 'عرض في الموقع', icon: <ExternalLink className="size-4" />, onClick: () => window.open(`${import.meta.env.BASE_URL}biens/${p.ref}`, '_blank', 'noopener'), hidden: !p.published },
    { label: 'نسخ الرابط', icon: <Copy className="size-4" />, onClick: () => void copyLink(p), hidden: !p.published },
    { label: 'إرسال عبر واتساب', icon: <WhatsAppIcon className="size-4" />, onClick: () => window.open(`https://wa.me/?text=${encodeURIComponent(propertyMessage(p, s, 'ar'))}`, '_blank', 'noopener'), hidden: !p.published },
    { label: 'طباعة بطاقة الواجهة', icon: <Printer className="size-4" />, onClick: () => void printPropertySheet(p, s, hoodName) },
    { label: p.featured ? 'إلغاء التمييز' : 'تمييز في الصفحة الرئيسية', icon: p.featured ? <StarOff className="size-4" /> : <Star className="size-4" />, onClick: () => save({ ...p, featured: !p.featured, updated_at: nowIso() }, { message: p.featured ? 'أُلغي التمييز' : 'سيظهر في «اختياراتنا» ★' }), hidden: !canEdit },
    { label: p.published ? 'إخفاء من الموقع' : 'نشر على الموقع', icon: p.published ? <EyeOff className="size-4" /> : <Eye className="size-4" />, onClick: () => togglePublish(p), hidden: !canEdit },
    { label: 'إنشاء نسخة', icon: <CopyPlus className="size-4" />, onClick: () => void duplicate(p), hidden: !canEdit },
    { label: 'حذف', icon: <Trash2 className="size-4" />, onClick: () => void remove(p), danger: true, hidden: !can('delete') },
  ]

  return (
    <>
      <PageHeader
        title="العقارات"
        subtitle={`${data.length} عقار في المحفظة · ${count('live')} منشور على الموقع`}
        icon={<Building2 className="size-6" />}
        actions={
          canEdit ? (
            <ButtonLink to="/admin/properties/new" variant="gold" icon={<Plus className="size-4" />}>
              عقار جديد
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="card overflow-hidden">
        <Tabs
          className="px-3"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'all', label: 'الكل', count: count('all') },
            { value: 'live', label: 'منشور', count: count('live') },
            { value: 'hidden', label: 'غير منشور / مسودة', count: count('hidden') },
            { value: 'reserved', label: 'محجوز', count: count('reserved') },
            { value: 'closed', label: 'مُباع / مُكترى', count: count('closed') },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <SearchBox value={q} onChange={setQ} placeholder="المرجع، العنوان، الحي…" className="min-w-[220px] flex-1" />
          <Select value={purpose} onChange={(e) => setPurpose(e.target.value as '' | Purpose)} className="h-10 w-auto py-1 text-sm">
            <option value="">بيع وكراء</option>
            <option value="sale">للبيع</option>
            <option value="rent">للكراء</option>
          </Select>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="h-10 w-auto py-1 text-sm">
            <option value="">كل الأنواع</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {typeName(t)}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-10 w-auto py-1 text-sm">
            <option value="updated">آخر تعديل</option>
            <option value="price_desc">الثمن: الأعلى</option>
            <option value="price_asc">الثمن: الأقل</option>
            <option value="views">الأكثر مشاهدة</option>
          </Select>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'table', label: '', icon: <List className="size-4" /> },
              { value: 'grid', label: '', icon: <LayoutGrid className="size-4" /> },
            ]}
          />
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={<Building2 className="size-7" />} title="لا توجد عقارات هنا" text={q || purpose || type ? 'جرّب تغيير البحث أو الفلاتر.' : 'ابدأ بإضافة أول عقار.'} action={canEdit ? <ButtonLink to="/admin/properties/new" variant="gold">إضافة عقار</ButtonLink> : undefined} />
          </div>
        ) : view === 'table' ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  {selectable && <CheckAll checked={selection.all} onChange={selection.toggleAll} />}
                  <th>العقار</th>
                  <th>النوع</th>
                  <th>الثمن</th>
                  <th>المساحة</th>
                  <th>الحالة</th>
                  <th>على الموقع</th>
                  <th>المشاهدات</th>
                  <th>آخر تعديل</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className={cn('cursor-pointer', selection.isSelected(p.id) && 'bg-gold/5')} onClick={() => nav(`/admin/properties/${p.id}`)}>
                    {selectable && <CheckCell checked={selection.isSelected(p.id)} onChange={() => selection.toggle(p.id)} label={p.ref} />}
                    <td>
                      <div className="flex min-w-[260px] items-center gap-3">
                        <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-sand">
                          {p.images[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover" loading="lazy" />}
                          {p.featured && <Star className="absolute top-1 start-1 size-3.5 fill-gold text-gold drop-shadow" />}
                        </div>
                        <div className="min-w-0">
                          <div className="num text-xs font-bold text-gold-700">{p.ref}</div>
                          <div className="max-w-[280px] truncate font-semibold text-navy">{p.title}</div>
                          <div className="text-xs text-muted">{hoodName(p.neighborhood)}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col items-start gap-1">
                        <Pill color={PURPOSE[p.purpose].color}>{PURPOSE[p.purpose].label}</Pill>
                        <span className="text-xs text-muted">{typeName(p.type)}</span>
                      </div>
                    </td>
                    <td className="num font-bold whitespace-nowrap text-navy">{fmtPrice(p.price, 'ar', p.purpose === 'rent')}</td>
                    <td className="num whitespace-nowrap text-muted">
                      {p.area ?? p.land_area ? `${fmtNumber(p.area ?? p.land_area)} m²` : '—'}
                      {p.rooms ? <div className="text-xs">{p.rooms} غرف</div> : null}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Select value={p.status} disabled={!canEdit} onChange={(e) => setStatus(p, e.target.value as PropertyStatus)} className="h-9 w-[118px] py-1 text-xs font-semibold" style={{ color: PROPERTY_STATUS[p.status].color }}>
                        {(Object.keys(PROPERTY_STATUS) as PropertyStatus[]).map((k) => (
                          <option key={k} value={k}>
                            {PROPERTY_STATUS[k].label}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Switch checked={p.published && p.status !== 'draft'} onChange={() => togglePublish(p)} disabled={!canEdit} />
                    </td>
                    <td className="num text-muted">{fmtNumber(p.views)}</td>
                    <td className="text-xs whitespace-nowrap text-muted">{fmtDate(p.updated_at)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <DropMenu items={menu(p)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {list.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-2xl border border-line bg-white transition hover:shadow-card">
                <Link to={`/admin/properties/${p.id}`} className="relative block aspect-[4/3] bg-sand">
                  {p.images[0] && <img src={p.images[0]} alt="" className="h-full w-full object-cover" loading="lazy" />}
                  <div className="absolute inset-x-2 top-2 flex justify-between">
                    <Pill color={PROPERTY_STATUS[p.status].color} className="bg-white/90">
                      {PROPERTY_STATUS[p.status].label}
                    </Pill>
                    {!p.published && (
                      <Pill color="#64748b" className="bg-white/90">
                        غير منشور
                      </Pill>
                    )}
                  </div>
                </Link>
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="num text-xs font-bold text-gold-700">{p.ref}</span>
                    <DropMenu items={menu(p)} />
                  </div>
                  <Link to={`/admin/properties/${p.id}`} className="line-clamp-1 font-semibold text-navy hover:text-gold-700">
                    {p.title}
                  </Link>
                  <div className={cn('num mt-1 text-sm font-bold text-navy')}>{fmtPrice(p.price, 'ar', p.purpose === 'rent')}</div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted">
                    <span>{hoodName(p.neighborhood)}</span>
                    <span className="num inline-flex items-center gap-1">
                      <Eye className="size-3.5" /> {fmtNumber(p.views)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BulkBar count={selection.count} onClear={selection.clear}>
        {canEdit && (
          <>
            <button type="button" className={bulkBtn} onClick={() => void bulk(picked.map((p) => ({ ...p, published: true, status: p.status === 'draft' ? 'available' : p.status })), 'نُشر على الموقع')}>
              نشر
            </button>
            <button type="button" className={bulkBtn} onClick={() => void bulk(picked.map((p) => ({ ...p, published: false })), 'أُخفي من الموقع')}>
              إخفاء
            </button>
            <button type="button" className={bulkBtn} onClick={() => void bulk(picked.map((p) => ({ ...p, featured: !picked.every((x) => x.featured) })), 'تم تغيير التمييز')}>
              {picked.every((x) => x.featured) ? 'إلغاء التمييز' : 'تمييز'}
            </button>
            <select
              className="h-9 rounded-xl bg-white/10 px-2 text-xs font-semibold text-white"
              value=""
              onChange={(e) => e.target.value && void bulk(picked.map((p) => ({ ...p, status: e.target.value as PropertyStatus })), `الحالة: ${PROPERTY_STATUS[e.target.value as PropertyStatus].label}`)}
            >
              <option value="" className="text-navy">
                تغيير الحالة…
              </option>
              {(Object.keys(PROPERTY_STATUS) as PropertyStatus[]).map((k) => (
                <option key={k} value={k} className="text-navy">
                  {PROPERTY_STATUS[k].label}
                </option>
              ))}
            </select>
          </>
        )}
        {can('export') && (
          <button type="button" className={bulkBtn} onClick={exportPicked}>
            تصدير
          </button>
        )}
        {can('delete') && (
          <button type="button" className={cn(bulkBtn, 'bg-danger/80 hover:bg-danger')} onClick={async () => (await bulkDelete(picked)) && selection.clear()}>
            حذف
          </button>
        )}
      </BulkBar>
    </>
  )
}
