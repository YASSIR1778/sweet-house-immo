import { Receipt, Scale } from 'lucide-react'
import { useSearchParams } from 'react-router'
import type { BuyerKind } from '@/shared/lib/fees'
import { cn } from '@/shared/ui/base'
import { BuyerCalculator, SellerCalculator } from '@/shared/ui/calculators'
import { PageHero } from '../components'
import { usePageMeta, useSite } from '../site'

const KINDS: BuyerKind[] = ['built', 'land', 'social']

export function Costs() {
  const { s, t, name } = useSite()
  usePageMeta(`${t('calc.title')} | ${name}`, t('calc.subtitle'))
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'seller' ? 'seller' : 'buyer'
  const price = Number(params.get('price')) || undefined
  const kindParam = params.get('kind') as BuyerKind | null
  const kind = kindParam && KINDS.includes(kindParam) ? kindParam : undefined

  const pick = (k: 'buyer' | 'seller') =>
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        if (k === 'seller') n.set('tab', 'seller')
        else n.delete('tab')
        return n
      },
      { replace: true },
    )

  return (
    <>
      <PageHero eyebrow={t('calc.eyebrow')} title={t('calc.title')} text={t('calc.subtitle')} image={s.site.hero_image} compact />
      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="mb-6 grid grid-cols-2 gap-1.5 rounded-2xl border border-line bg-white p-1.5 shadow-card sm:inline-grid">
          {(['buyer', 'seller'] as const).map((k) => (
            <button key={k} type="button" onClick={() => pick(k)} className={cn('flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition', tab === k ? 'bg-navy text-white' : 'text-navy hover:bg-sand')}>
              {k === 'buyer' ? <Receipt className="size-4" /> : <Scale className="size-4" />}
              {t(`calc.tab.${k}`)}
            </button>
          ))}
        </div>
        {tab === 'buyer' ? <BuyerCalculator key="buyer" initialPrice={price} initialKind={kind} /> : <SellerCalculator key="seller" initialPrice={price} />}
      </section>
    </>
  )
}
