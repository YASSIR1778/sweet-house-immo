import { Camera, ClipboardCheck, Handshake, Home, ShieldCheck, Timer } from 'lucide-react'
import { WhatsAppIcon } from '@/shared/ui/icons'
import { useState } from 'react'
import { PROPERTY_TYPES } from '@/shared/lib/config'
import { pick, waLink } from '@/shared/lib/format'
import type { LeadKind } from '@/shared/lib/types'
import { ButtonLink, Field, Input, Reveal, Select, cn } from '@/shared/ui/base'
import { LeadForm, PageHero } from '../components'
import { usePageMeta, useSite } from '../site'

export function Sell() {
  const { s, lang, t, typeName, name } = useSite()
  usePageMeta(`${t('sell.title')} | ${name}`, t('sell.subtitle'))
  const [purpose, setPurpose] = useState<'sale' | 'rent' | 'valuation'>('sale')
  const kind: LeadKind = purpose === 'valuation' ? 'valuation' : 'sell'
  const steps = [
    { icon: ClipboardCheck, k: 1 },
    { icon: Timer, k: 2 },
    { icon: Camera, k: 3 },
    { icon: Handshake, k: 4 },
  ]
  return (
    <>
      <PageHero eyebrow={t('sell.eyebrow')} title={t('sell.title')} text={t('sell.subtitle')} image={s.site.hero_image} />

      <section className="mx-auto -mt-10 max-w-7xl px-4 md:px-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {steps.map(({ icon: Icon, k }, i) => (
            <Reveal key={k} delay={i * 80}>
              <div className="h-full rounded-[18px] border border-line bg-white p-5 shadow-card">
                <div className="mb-3 flex items-center gap-3">
                  <span className="num flex size-9 items-center justify-center rounded-full bg-navy font-display text-gold">{k}</span>
                  <Icon className="size-5 text-gold-600" />
                </div>
                <h3 className="font-bold text-navy">{t(`sell.step${k}.t`)}</h3>
                <p className="mt-1 text-sm text-muted">{t(`sell.step${k}.d`)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
          <Reveal>
            <div className="rounded-[22px] border border-line bg-white p-6 shadow-card md:p-8">
              <h2 className="font-display text-2xl text-navy">{t('sell.step1.t')}</h2>
              <p className="mt-1 text-sm text-muted">{t('sell.step1.d')}</p>
              <div className="mt-6">
                <span className="label">{t('sell.purpose')}</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['sale', 'rent', 'valuation'] as const).map((v) => (
                    <button key={v} type="button" onClick={() => setPurpose(v)} className={cn('rounded-xl border px-3 py-3 text-sm font-semibold transition', purpose === v ? 'border-navy bg-navy text-white' : 'border-line bg-white text-navy hover:border-navy/40')}>
                      {t(`sell.purpose.${v}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-5">
                <LeadForm
                  kind={kind}
                  showMessage
                  messageLabel={t('sell.notes')}
                  submitLabel={t('cta.sell.button')}
                  buildMeta={(fd) => ({
                    purpose,
                    type: fd.get('type') || null,
                    neighborhood: fd.get('neighborhood') || null,
                    area: fd.get('area') ? Number(fd.get('area')) : null,
                    price: fd.get('price') ? Number(fd.get('price')) : null,
                  })}
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label={t('sell.type')}>
                      <Select name="type" defaultValue="apartment">
                        {PROPERTY_TYPES.map((v) => (
                          <option key={v} value={v}>
                            {typeName(v)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t('search.neighborhood')}>
                      <Select name="neighborhood" defaultValue="">
                        <option value="">—</option>
                        {s.catalog.neighborhoods.map((n) => (
                          <option key={n.id} value={n.id}>
                            {pick(n.name, lang)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t('sell.area')}>
                      <Input name="area" type="number" inputMode="numeric" min={0} className="num" placeholder="90" />
                    </Field>
                    <Field label={t('sell.price')}>
                      <Input name="price" type="number" inputMode="numeric" min={0} className="num" placeholder="850000" />
                    </Field>
                  </div>
                </LeadForm>
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="space-y-4">
              <div className="rounded-[18px] bg-navy p-6 text-white">
                <ShieldCheck className="size-8 text-gold" />
                <h3 className="mt-3 text-lg font-bold">{t('why.2.t')}</h3>
                <p className="mt-1 text-sm text-white/75">{t('why.2.d')}</p>
              </div>
              <div className="rounded-[18px] border border-line bg-white p-6">
                <Home className="size-8 text-gold-600" />
                <h3 className="mt-3 text-lg font-bold text-navy">{t('why.1.t')}</h3>
                <p className="mt-1 text-sm text-muted">{t('why.1.d')}</p>
              </div>
              <ButtonLink to={waLink(s.agency.whatsapp, lang === 'ar' ? 'السلام عليكم، أريد بيع/كراء عقاري.' : lang === 'fr' ? 'Bonjour, je souhaite vendre/louer mon bien.' : 'Hola, quiero vender/alquilar mi inmueble.')} external variant="whatsapp" size="lg" className="w-full" icon={<WhatsAppIcon className="size-5" />}>
                {t('cta.whatsapp')}
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
