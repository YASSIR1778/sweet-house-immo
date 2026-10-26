import { ChevronDown, Info, Printer, Receipt, Scale } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useSettings } from '@/shared/lib/data'
import { buyerCosts, sellerCosts, type AcquisitionMode, type BuyerKind, type CostLine } from '@/shared/lib/fees'
import { fmtDate, fmtNumber, fmtPrice, waLink } from '@/shared/lib/format'
import { useI18n } from '@/shared/lib/i18n'
import type { Settings } from '@/shared/lib/types'
import { Button, Field, Input, Select, cn } from './base'
import { WhatsAppIcon } from './icons'

/** A printable / shareable version of a result (the dashboard prints it with the agency header). */
export interface CostQuote {
  title: string
  intro: string
  rows: { label: string; amount: number; note?: string }[]
  totals: { label: string; amount: number; strong?: boolean }[]
  notes: string[]
}

const toNum = (v: string) => {
  const n = Number(v.replace(/[\s,]/g, ''))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function MoneyField({ label, value, onChange, hint }: { label: ReactNode; value: number; onChange: (v: number) => void; hint?: ReactNode }) {
  const { lang } = useI18n()
  return (
    <Field label={label} hint={hint ?? (value > 0 ? fmtPrice(value, lang) : undefined)}>
      <Input type="number" inputMode="numeric" min={0} dir="ltr" className="num" value={value || ''} placeholder="0" onChange={(e) => onChange(toNum(e.target.value))} />
    </Field>
  )
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition', checked ? 'border-teal bg-teal/5' : 'border-line bg-white hover:border-line-2')}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[#0f766e]" />
      <span className="text-navy">{children}</span>
    </label>
  )
}

function Choice<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 3)}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} className={cn('rounded-xl border px-3 py-2.5 text-sm font-semibold transition', value === o.value ? 'border-navy bg-navy text-white' : 'border-line bg-white text-navy hover:border-navy/40')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Lines({ lines }: { lines: CostLine[] }) {
  const { t, lang } = useI18n()
  return (
    <ul className="divide-y divide-line">
      {lines.map((l) => (
        <li key={l.key} className="flex items-start justify-between gap-3 py-2.5 text-sm">
          <span className="text-navy">
            {t(`calc.line.${l.key}`)}
            {l.rate != null && l.rate > 0 && (
              <span className="num mx-1.5 inline-block text-xs text-subtle" dir="ltr">
                {l.rate}%
              </span>
            )}
            {l.estimate && <span className="mx-1 inline-block rounded-full bg-sand px-2 py-0.5 text-[10px] font-semibold text-muted">{t('calc.estimate')}</span>}
          </span>
          <b className="num shrink-0 text-navy">{fmtPrice(l.amount, lang)}</b>
        </li>
      ))}
    </ul>
  )
}

function Notes({ items }: { items: string[] }) {
  return (
    <div className="mt-4 space-y-1.5 text-xs leading-relaxed text-muted">
      {items.map((n, i) => (
        <p key={i} className="flex gap-1.5">
          <Info className="mt-0.5 size-3.5 shrink-0 text-subtle" />
          <span>{n}</span>
        </p>
      ))}
    </div>
  )
}

function Footer({ quote, onPrint, waText }: { quote: CostQuote; onPrint?: (q: CostQuote) => void; waText: string }) {
  const { t } = useI18n()
  const { data } = useSettings()
  const s = data as Settings
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {onPrint ? (
        <>
          <Button variant="outline" icon={<Printer className="size-4" />} onClick={() => onPrint(quote)}>
            طباعة للزبون
          </Button>
          <Button variant="whatsapp" icon={<WhatsAppIcon className="size-4" />} onClick={() => window.open(waLink('', [quote.title, ...quote.rows.map((r) => `• ${r.label}: ${fmtNumber(r.amount)} DH`), ...quote.totals.map((x) => `${x.label}: ${fmtNumber(x.amount)} DH`)].join('\n')), '_blank', 'noopener')}>
            إرسال بالواتساب
          </Button>
        </>
      ) : (
        <a href={waLink(s.agency.whatsapp, waText)} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-bold text-white shadow-soft hover:brightness-105">
          <WhatsAppIcon className="size-4" /> {t('calc.ask')}
        </a>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Buyer                                                                */
/* ------------------------------------------------------------------ */
export function BuyerCalculator({ initialPrice, initialKind, onPrint }: { initialPrice?: number; initialKind?: BuyerKind; onPrint?: (q: CostQuote) => void }) {
  const { t, lang } = useI18n()
  const { data } = useSettings()
  const s = data as Settings
  const f = s.fees
  const [price, setPrice] = useState(initialPrice && initialPrice > 0 ? initialPrice : 1_000_000)
  const [kind, setKind] = useState<BuyerKind>(initialKind ?? 'built')
  const [cash, setCash] = useState(0)
  const [loan, setLoan] = useState(0)
  const [agency, setAgency] = useState(true)
  const r = useMemo(() => buyerCosts({ price, kind, cash, loan, agency }, f, s.commission), [price, kind, cash, loan, agency, f, s.commission])

  const notes = [t('calc.note.buyer'), t('calc.note.cash', { n: f.registration.cash_extra, cap: fmtPrice(f.registration.cash_threshold, lang) }), t('calc.note.reviewed', { d: fmtDate(f.reviewed_at, lang) }), t('calc.disclaimer')]
  const quote: CostQuote = {
    title: `${t('calc.tab.buyer')} · ${fmtPrice(price, lang)}`,
    intro: `${t('calc.kind')}: ${t(`calc.kind.${kind}`)}`,
    rows: r.lines.map((l) => ({ label: t(`calc.line.${l.key}`), amount: l.amount, note: [l.rate ? `${l.rate}%` : '', l.estimate ? t('calc.estimate') : ''].filter(Boolean).join(' · ') || undefined })),
    totals: [
      { label: t('calc.total'), amount: r.total, strong: true },
      { label: t('calc.cashNeeded'), amount: r.cashNeeded },
    ],
    notes,
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.05fr]">
      <div className="space-y-4">
        <MoneyField label={t('calc.price')} value={price} onChange={setPrice} />
        <Field label={t('calc.kind')} hint={kind === 'social' ? t('calc.kind.social.hint') : undefined}>
          <Choice
            value={kind}
            onChange={setKind}
            options={(['built', 'land', 'social'] as BuyerKind[]).map((k) => ({ value: k, label: t(`calc.kind.${k}`) }))}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MoneyField label={t('calc.loan')} value={loan} onChange={setLoan} hint={t('calc.loan.hint')} />
          <MoneyField label={t('calc.cash')} value={cash} onChange={setCash} hint={t('calc.cash.hint')} />
        </div>
        <Check checked={agency} onChange={setAgency}>
          {t('calc.agency')}
        </Check>
      </div>

      <div className="rounded-[18px] border border-line bg-white p-5 shadow-card">
        <Lines lines={r.lines} />
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-navy p-4 text-white">
          <span className="font-semibold">{t('calc.total')}</span>
          <span className="text-end">
            <b className="num block text-2xl text-gold-300">{fmtPrice(r.total, lang)}</b>
            <span className="num text-xs text-white/60">{t('calc.share', { n: (Math.round(r.share * 10) / 10).toString() })}</span>
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl bg-sand p-4">
          <span className="text-sm font-semibold text-navy">{t('calc.cashNeeded')}</span>
          <b className="num text-lg text-navy">{fmtPrice(r.cashNeeded, lang)}</b>
        </div>
        {r.aid > 0 && f.aid.enabled && <p className="mt-3 rounded-xl bg-teal/10 p-3 text-xs leading-relaxed text-teal">{t('calc.aid', { n: fmtPrice(r.aid, lang) })}</p>}
        <Notes items={notes} />
        <Footer quote={quote} onPrint={onPrint} waText={t('calc.ask.text', { w: t('calc.ask.buy'), p: fmtPrice(price, lang) })} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Seller                                                               */
/* ------------------------------------------------------------------ */
export function SellerCalculator({ initialPrice, onPrint }: { initialPrice?: number; onPrint?: (q: CostQuote) => void }) {
  const { t, lang } = useI18n()
  const { data } = useSettings()
  const s = data as Settings
  const f = s.fees
  const thisYear = new Date().getFullYear()
  const [price, setPrice] = useState(initialPrice && initialPrice > 0 ? initialPrice : 1_500_000)
  const [mode, setMode] = useState<AcquisitionMode>('purchase')
  const [year, setYear] = useState(thisYear - 10)
  const [acquired, setAcquired] = useState(900_000)
  const [useActual, setUseActual] = useState(false)
  const [actual, setActual] = useState(0)
  const [investments, setInvestments] = useState(0)
  const [interest, setInterest] = useState(0)
  const [agency, setAgency] = useState(true)
  const [residence, setResidence] = useState(false)
  const [social, setSocial] = useState(false)
  const [small, setSmall] = useState(true)
  const [more, setMore] = useState(false)
  const [otherCosts, setOtherCosts] = useState(0)
  const [release, setRelease] = useState(false)
  const [releaseFees, setReleaseFees] = useState(0)
  const [loanBalance, setLoanBalance] = useState(0)
  const [localTaxes, setLocalTaxes] = useState(0)

  const purchase = mode === 'purchase'
  const r = useMemo(
    () =>
      sellerCosts(
        {
          price,
          mode,
          year,
          acquired,
          actualCosts: purchase ? (useActual ? actual : null) : actual,
          investments,
          interest: purchase ? interest : 0,
          otherCosts,
          agency,
          residence,
          social: social && price <= f.tpi.social_cap,
          small: small && price <= f.tpi.small_cap,
          release,
          releaseFees: release ? releaseFees : 0,
          localTaxes,
          loanBalance,
        },
        f,
        s.commission,
      ),
    [price, mode, year, acquired, purchase, useActual, actual, investments, interest, otherCosts, agency, residence, social, small, release, releaseFees, localTaxes, loanBalance, f, s.commission],
  )
  const years = useMemo(() => Array.from({ length: thisYear - 1946 + 1 }, (_, i) => thisYear - i), [thisYear])
  const cap = (n: number) => fmtPrice(n, lang)

  const exemptionText =
    r.exemption === 'residence'
      ? t('calc.ex.residence', { n: f.tpi.residence_years, r: f.tpi.min_rate, cap: cap(f.tpi.residence_cap) })
      : r.exemption === 'social'
        ? t('calc.ex.social')
        : r.exemption === 'small'
          ? t('calc.ex.small', { cap: cap(f.tpi.small_cap) })
          : null
  const notes = [t('calc.note.seller'), t('calc.note.reviewed', { d: fmtDate(f.reviewed_at, lang) }), t('calc.disclaimer')]
  const quote: CostQuote = {
    title: `${t('calc.tab.seller')} · ${fmtPrice(price, lang)}`,
    intro: exemptionText ?? `${t('calc.tpi.profit')}: ${fmtPrice(r.profit, lang)} · ${t('calc.tpi.coef', { y: year })}: ${r.coef}`,
    rows: r.lines.map((l) => ({ label: t(`calc.line.${l.key}`), amount: l.amount, note: l.estimate ? t('calc.estimate') : undefined })),
    totals: [
      { label: t('calc.sellerTotal'), amount: r.total },
      { label: t('calc.net'), amount: r.net, strong: true },
      ...(loanBalance > 0 ? [{ label: t('calc.netAfterLoan'), amount: r.netAfterLoan }] : []),
    ],
    notes,
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.05fr]">
      <div className="space-y-4">
        <MoneyField label={t('calc.sprice')} value={price} onChange={setPrice} />
        <Field label={t('calc.mode')}>
          <Choice value={mode} onChange={setMode} options={(['purchase', 'inheritance', 'donation'] as AcquisitionMode[]).map((m) => ({ value: m, label: t(`calc.mode.${m}`) }))} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('calc.year')} hint={t('calc.tpi.coef', { y: year }) + ` : ${r.coef}`}>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="num">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </Field>
          <MoneyField label={purchase ? t('calc.acquired') : t('calc.acquired.declared')} value={acquired} onChange={setAcquired} />
        </div>
        {purchase ? (
          <>
            <Check checked={useActual} onChange={setUseActual}>
              {t('calc.useActual', { n: f.tpi.flat_costs })}
            </Check>
            {useActual && <MoneyField label={t('calc.actual')} value={actual} onChange={setActual} />}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MoneyField label={t('calc.investments')} value={investments} onChange={setInvestments} />
              <MoneyField label={t('calc.interest')} value={interest} onChange={setInterest} />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MoneyField label={t('calc.actual')} value={actual} onChange={setActual} />
            <MoneyField label={t('calc.investments')} value={investments} onChange={setInvestments} />
          </div>
        )}
        <div className="space-y-2">
          <Check checked={residence} onChange={setResidence}>
            {t('calc.residence', { n: f.tpi.residence_years })}
          </Check>
          {price <= f.tpi.social_cap && (
            <Check checked={social} onChange={setSocial}>
              {t('calc.social', { n: f.tpi.social_years })}
            </Check>
          )}
          {price <= f.tpi.small_cap && (
            <Check checked={small} onChange={setSmall}>
              {t('calc.small', { n: cap(f.tpi.small_cap) })}
            </Check>
          )}
          <Check checked={agency} onChange={setAgency}>
            {t('calc.agency')}
          </Check>
        </div>
        <button type="button" onClick={() => setMore(!more)} className="flex w-full items-center justify-between rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-navy">
          {t('calc.more')}
          <ChevronDown className={cn('size-4 transition', more && 'rotate-180')} />
        </button>
        {more && (
          <div className="space-y-4 rounded-2xl border border-line bg-ivory p-4">
            <Check checked={release} onChange={setRelease}>
              {t('calc.release')}
            </Check>
            {release && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <MoneyField label={t('calc.releaseFees')} value={releaseFees} onChange={setReleaseFees} />
                <MoneyField label={t('calc.loanBalance')} value={loanBalance} onChange={setLoanBalance} />
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MoneyField label={t('calc.localTaxes')} value={localTaxes} onChange={setLocalTaxes} />
              <MoneyField label={t('calc.otherCosts')} value={otherCosts} onChange={setOtherCosts} />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-[18px] border border-line bg-white p-5 shadow-card">
        <div className="mb-3 rounded-2xl border border-gold/30 bg-gold/5 p-4">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-navy">
            <Scale className="size-4 text-gold-600" /> {t('calc.tpi.title')}
          </h4>
          {exemptionText ? (
            <p className="text-sm leading-relaxed text-navy">{exemptionText}</p>
          ) : (
            <dl className="space-y-1.5 text-sm">
              {[
                [t('calc.tpi.base'), fmtPrice(r.base, lang)],
                [t('calc.tpi.coef', { y: year }), `× ${r.coef}`],
                [t('calc.tpi.revalued'), fmtPrice(r.revalued, lang)],
                [t('calc.tpi.selling'), fmtPrice(r.sellingCosts, lang)],
                [t('calc.tpi.profit'), fmtPrice(r.profit, lang)],
                [t('calc.tpi.rate', { n: f.tpi.rate }), fmtPrice(r.taxProfit, lang)],
                [t('calc.tpi.min', { n: f.tpi.min_rate }), fmtPrice(r.taxMin, lang)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="num shrink-0 font-semibold text-navy">{v}</dd>
                </div>
              ))}
              <p className="pt-1 text-xs text-muted">{t('calc.tpi.due')}</p>
            </dl>
          )}
        </div>
        <Lines lines={r.lines} />
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-sand p-4">
          <span className="text-sm font-semibold text-navy">{t('calc.sellerTotal')}</span>
          <b className="num text-lg text-navy">{fmtPrice(r.total, lang)}</b>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl bg-navy p-4 text-white">
          <span className="font-semibold">{t('calc.net')}</span>
          <b className="num text-2xl text-gold-300">{fmtPrice(r.net, lang)}</b>
        </div>
        {loanBalance > 0 && (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl bg-sand p-4">
            <span className="text-sm font-semibold text-navy">{t('calc.netAfterLoan')}</span>
            <b className="num text-lg text-navy">{fmtPrice(r.netAfterLoan, lang)}</b>
          </div>
        )}
        <Notes items={notes} />
        <Footer quote={quote} onPrint={onPrint} waText={t('calc.ask.text', { w: t('calc.ask.sell'), p: fmtPrice(price, lang) })} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Compact box for a property page                                      */
/* ------------------------------------------------------------------ */
export function BuyerCostsBox({ price, kind, to }: { price: number; kind: BuyerKind; to: string }) {
  const { t, lang } = useI18n()
  const { data } = useSettings()
  const s = data as Settings
  const r = useMemo(() => buyerCosts({ price, kind, cash: 0, loan: 0, agency: true }, s.fees, s.commission), [price, kind, s.fees, s.commission])
  const pick = (k: string) => r.lines.filter((l) => l.key === k || (k === 'notary' && (l.key === 'notary_vat' || l.key === 'disbursements'))).reduce((a, l) => a + l.amount, 0)
  const rows = [
    ['calc.line.registration', pick('registration')],
    ['calc.line.conservation', pick('conservation')],
    ['calc.line.notary', pick('notary')],
    ['calc.line.agency', pick('agency')],
  ].filter(([, v]) => Number(v) > 0) as [string, number][]
  return (
    <div className="rounded-[18px] border border-line bg-white p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-teal/10 text-teal">
          <Receipt className="size-5" />
        </span>
        <div>
          <h3 className="font-bold text-navy">{t('calc.box.title')}</h3>
          <p className="text-xs text-muted">{t('calc.disclaimer')}</p>
        </div>
      </div>
      <ul className="divide-y divide-line text-sm">
        {rows.map(([k, v]) => (
          <li key={k} className="flex justify-between gap-3 py-2">
            <span className="text-muted">{t(k)}</span>
            <b className="num text-navy">{fmtPrice(v, lang)}</b>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between rounded-2xl bg-navy p-4 text-white">
        <span className="font-semibold">{t('calc.total')}</span>
        <span className="text-end">
          <b className="num block text-xl text-gold-300">{fmtPrice(r.total, lang)}</b>
          <span className="num text-xs text-white/60">{t('calc.share', { n: (Math.round(r.share * 10) / 10).toString() })}</span>
        </span>
      </div>
      <Link to={to} className="mt-3 inline-flex text-sm font-semibold text-teal hover:underline">
        {t('calc.box.more')}
      </Link>
    </div>
  )
}
