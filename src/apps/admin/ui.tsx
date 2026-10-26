import { Check, ChevronDown, MoreVertical, Phone, Search, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { fmtPhone, telLink, waLink } from '@/shared/lib/format'
import type { L10n } from '@/shared/lib/types'
import { Input, Textarea, cn } from '@/shared/ui/base'
import { WhatsAppIcon } from '@/shared/ui/icons'

/* ------------------------------------------------------------------ */
export function PageHeader({ title, subtitle, icon, actions }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-3">
        {icon && <span className="hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-navy text-gold shadow-soft sm:flex">{icon}</span>}
        <div>
          <h1 className="font-display text-2xl leading-tight text-navy md:text-[1.9rem]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ title, icon, action, children, className, bodyClass, id }: { title?: ReactNode; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; id?: string }) {
  return (
    <section id={id} className={cn('card flex flex-col', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-navy">
            {icon && <span className="text-gold-600">{icon}</span>}
            {title}
          </h2>
          {action}
        </header>
      )}
      <div className={cn('flex-1 p-5', bodyClass)}>{children}</div>
    </section>
  )
}

export function Stat({ label, value, hint, icon, accent = '#0b1b33', to, trend }: { label: string; value: ReactNode; hint?: ReactNode; icon: ReactNode; accent?: string; to?: string; trend?: { value: number; label?: string } | null }) {
  const body = (
    <div className="card group relative h-full overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-card">
      <div className="absolute -top-10 -end-10 size-28 rounded-full opacity-[0.08] transition group-hover:opacity-[0.14]" style={{ background: accent }} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold text-muted">{label}</div>
          <div className="num mt-2 text-[1.75rem] leading-none font-extrabold text-navy">{value}</div>
        </div>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-soft" style={{ background: accent }}>
          {icon}
        </span>
      </div>
      {(hint || trend) && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted">
          {trend && (
            <span className={cn('num rounded-full px-1.5 py-0.5 font-bold', trend.value >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger')} dir="ltr">
              {trend.value >= 0 ? '▲' : '▼'} {Math.abs(trend.value)}%
            </span>
          )}
          {hint}
        </div>
      )}
    </div>
  )
  return to ? (
    <Link to={to} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  )
}

export function Pill({ color, children, dot, className }: { color: string; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-none font-semibold whitespace-nowrap', className)} style={{ color, background: `${color}18` }}>
      {dot && <span className="size-1.5 rounded-full" style={{ background: color }} />}
      {children}
    </span>
  )
}

const AVATAR_COLORS = ['#0b1b33', '#a8832f', '#0f766e', '#7c3aed', '#b45309', '#1d4ed8', '#be185d']
export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const n = name.replace(/\(.*?\)/g, '').trim() || '?'
  let h = 0
  for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const color = AVATAR_COLORS[h % AVATAR_COLORS.length]
  const letters = n
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
  const s = { sm: 'size-7 text-[11px]', md: 'size-9 text-xs', lg: 'size-12 text-base' }[size]
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white', s, className)} style={{ background: color }} title={name}>
      {letters}
    </span>
  )
}

/** Call + WhatsApp buttons next to a phone number. */
export function PhoneLinks({ phone, waText, showNumber = true, className }: { phone: string | null | undefined; waText?: string; showNumber?: boolean; className?: string }) {
  if (!phone) return <span className="text-subtle">—</span>
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {showNumber && (
        <span className="num text-sm whitespace-nowrap" dir="ltr">
          {fmtPhone(phone)}
        </span>
      )}
      <a href={telLink(phone)} onClick={(e) => e.stopPropagation()} className="inline-flex size-8 items-center justify-center rounded-full bg-navy/5 text-navy transition hover:bg-navy hover:text-white" title="اتصال" aria-label="اتصال">
        <Phone className="size-3.5" />
      </a>
      <a href={waLink(phone, waText)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex size-8 items-center justify-center rounded-full bg-[#25D366]/10 text-[#128C7E] transition hover:bg-[#25D366] hover:text-white" title="واتساب" aria-label="واتساب">
        <WhatsAppIcon className="size-3.5" />
      </a>
    </span>
  )
}

export function SearchBox({ value, onChange, placeholder = 'بحث…', className, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 py-2 ps-9 text-sm" autoFocus={autoFocus} />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-subtle hover:bg-sand hover:text-navy" aria-label="مسح">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Searchable select                                                    */
/* ------------------------------------------------------------------ */
export interface ComboOption {
  value: string
  label: string
  sub?: string
  keywords?: string
}

export function Combo({ value, onChange, options, placeholder = 'اختر…', allowClear = true, className, disabled }: { value: string | null | undefined; onChange: (v: string | null) => void; options: ComboOption[]; placeholder?: string; allowClear?: boolean; className?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const k = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), setOpen(false))
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k, true)
    return () => {
      document.removeEventListener('mousedown', h)
      document.removeEventListener('keydown', k, true)
    }
  }, [open])
  const sel = options.find((o) => o.value === value)
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (s ? options.filter((o) => `${o.label} ${o.sub ?? ''} ${o.keywords ?? ''}`.toLowerCase().includes(s)) : options).slice(0, 60)
  }, [q, options])
  const choose = (v: string | null) => {
    onChange(v)
    setOpen(false)
    setQ('')
  }
  return (
    <div ref={ref} className={cn('relative', className)}>
      <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)} className="input flex items-center gap-2 text-start disabled:opacity-60">
        <span className="min-w-0 flex-1 truncate">
          {sel ? (
            <>
              {sel.label}
              {sel.sub && <span className="ms-2 text-xs text-subtle">{sel.sub}</span>}
            </>
          ) : (
            <span className="text-subtle">{placeholder}</span>
          )}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted" />
      </button>
      {open && (
        <div className="anim-pop absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-line bg-white shadow-pop">
          <div className="border-b border-line p-2">
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث بالاسم، المرجع أو الهاتف…"
              className="h-9 py-1 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (list[0]) choose(list[0].value)
                }
              }}
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {allowClear && value && (
              <li>
                <button type="button" onClick={() => choose(null)} className="w-full px-3 py-2 text-start text-sm text-muted hover:bg-sand">
                  — بدون —
                </button>
              </li>
            )}
            {list.map((o) => (
              <li key={o.value}>
                <button type="button" onClick={() => choose(o.value)} className={cn('flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-sand', o.value === value && 'bg-sand/70')}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-navy">{o.label}</span>
                    {o.sub && <span className="block truncate text-xs text-muted">{o.sub}</span>}
                  </span>
                  {o.value === value && <Check className="size-4 text-teal" />}
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="px-3 py-4 text-center text-sm text-subtle">لا توجد نتائج</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Kebab / action menu (fixed position so tables never clip it)         */
/* ------------------------------------------------------------------ */
export interface MenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
  hidden?: boolean
}

export function DropMenu({ items, trigger, label = 'خيارات', className }: { items: MenuItem[]; trigger?: ReactNode; label?: string; className?: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const visible = items.filter((i) => !i.hidden)

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (pos) return setPos(null)
    const r = btn.current!.getBoundingClientRect()
    const w = 230
    const h = visible.length * 40 + 12
    const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8)
    const top = r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4
    setPos({ top, left })
  }

  useLayoutEffect(() => {
    if (!pos) return
    const close = (e: Event) => {
      if (e.type === 'mousedown' && (menu.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node))) return
      setPos(null)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setPos(null)
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('keydown', key)
    }
  }, [pos])

  return (
    <>
      <button ref={btn} type="button" onClick={toggle} aria-label={label} title={label} className={cn(trigger ? '' : 'inline-flex size-9 items-center justify-center rounded-full text-muted transition hover:bg-sand hover:text-navy', className)}>
        {trigger ?? <MoreVertical className="size-4" />}
      </button>
      {pos && (
        <div ref={menu} className="anim-pop fixed z-[130] w-[230px] overflow-hidden rounded-xl border border-line bg-white py-1.5 shadow-pop" style={{ top: pos.top, left: pos.left }} onClick={(e) => e.stopPropagation()}>
          {visible.map((it) => (
            <button
              key={it.label}
              type="button"
              onClick={() => {
                setPos(null)
                it.onClick()
              }}
              className={cn('flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start text-sm transition hover:bg-sand', it.danger ? 'text-danger' : 'text-navy')}
            >
              <span className={cn('shrink-0', it.danger ? 'text-danger' : 'text-muted')}>{it.icon}</span>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
export function Chips<T extends string>({ options, value, onChange, className }: { options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map((o) => {
        const on = value.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cn('inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition', on ? 'border-navy bg-navy text-white' : 'border-line-2 bg-white text-navy hover:border-navy/40')}
          >
            {on && <Check className="size-3" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { value: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn('no-scrollbar flex gap-1 overflow-x-auto border-b border-line', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cn('-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition', value === t.value ? 'border-gold text-navy' : 'border-transparent text-muted hover:text-navy')}
        >
          {t.label}
          {t.count != null && <span className={cn('num rounded-full px-1.5 py-0.5 text-[11px]', value === t.value ? 'bg-gold/20 text-gold-700' : 'bg-sand text-muted')}>{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

/** Three inputs (AR / FR / ES) for a translated text. */
export function L10nField({ label, value, onChange, multiline, rows = 3, hint }: { label: string; value: L10n; onChange: (v: L10n) => void; multiline?: boolean; rows?: number; hint?: string }) {
  const langs: { k: keyof L10n; tag: string; dir: 'rtl' | 'ltr' }[] = [
    { k: 'ar', tag: 'ع', dir: 'rtl' },
    { k: 'fr', tag: 'FR', dir: 'ltr' },
    { k: 'es', tag: 'ES', dir: 'ltr' },
  ]
  return (
    <div>
      <span className="label">{label}</span>
      <div className="space-y-2">
        {langs.map(({ k, tag, dir }) => (
          <div key={k} className="flex items-start gap-2">
            <span className="mt-2.5 flex h-6 w-8 shrink-0 items-center justify-center rounded-md bg-sand text-[10px] font-bold text-navy">{tag}</span>
            {multiline ? (
              <Textarea dir={dir} rows={rows} value={value?.[k] ?? ''} onChange={(e) => onChange({ ...value, [k]: e.target.value })} className="min-h-0 text-sm" />
            ) : (
              <Input dir={dir} value={value?.[k] ?? ''} onChange={(e) => onChange({ ...value, [k]: e.target.value })} className="text-sm" />
            )}
          </div>
        ))}
      </div>
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </div>
  )
}

export function MiniEmpty({ icon, text, action }: { icon?: ReactNode; text: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted">
      {icon && <span className="text-subtle">{icon}</span>}
      <p>{text}</p>
      {action}
    </div>
  )
}

/** Horizontal bar used for small breakdowns. */
export function BarRow({ label, value, max, color, suffix }: { label: ReactNode; value: number; max: number; color: string; suffix?: ReactNode }) {
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-text">{label}</span>
        <span className="num font-bold text-navy">
          {value}
          {suffix}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sand">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
