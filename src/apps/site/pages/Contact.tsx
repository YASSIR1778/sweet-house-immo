import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { fmtPhone, pick, telLink, waLink } from '@/shared/lib/format'
import { Field, Reveal, Select } from '@/shared/ui/base'
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from '@/shared/ui/icons'
import { PropertyMap } from '@/shared/ui/map'
import { LeadForm, PageHero } from '../components'
import { usePageMeta, useSite } from '../site'

export function Contact() {
  const { s, lang, t, name } = useSite()
  usePageMeta(`${t('nav.contact')} | ${name}`)
  const items = [
    { icon: MapPin, label: t('contact.address'), value: pick(s.agency.address, lang) },
    {
      icon: Phone,
      label: t('contact.phone'),
      value: (
        <a href={telLink(s.agency.phone)} className="num" dir="ltr">
          {fmtPhone(s.agency.phone)}
        </a>
      ),
    },
    {
      icon: WhatsAppIcon,
      label: 'WhatsApp',
      value: (
        <a href={waLink(s.agency.whatsapp)} target="_blank" rel="noopener noreferrer" className="num" dir="ltr">
          {fmtPhone('+' + s.agency.whatsapp.replace(/^\+/, ''))}
        </a>
      ),
    },
    s.agency.email
      ? {
          icon: Mail,
          label: t('contact.email'),
          value: (
            <a href={`mailto:${s.agency.email}`} dir="ltr">
              {s.agency.email}
            </a>
          ),
        }
      : null,
    { icon: Clock, label: t('contact.hours'), value: <span className="num">{pick(s.agency.hours, lang)}</span> },
  ].filter(Boolean) as { icon: ComponentType<{ className?: string }>; label: string; value: ReactNode }[]

  const socials = [
    { href: s.agency.facebook, icon: FacebookIcon, label: 'Facebook' },
    { href: s.agency.instagram, icon: InstagramIcon, label: 'Instagram' },
    { href: s.agency.tiktok, icon: TikTokIcon, label: 'TikTok' },
  ].filter((x) => x.href)

  return (
    <>
      <PageHero compact eyebrow={t('contact.eyebrow')} title={t('contact.title')} />
      <section className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.3fr]">
          <Reveal>
            <ul className="space-y-3">
              {items.map(({ icon: Icon, label, value }) => (
                <li key={label} className="flex items-start gap-4 rounded-[18px] border border-line bg-white p-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sand text-gold-700">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</div>
                    <div className="mt-0.5 font-semibold text-navy">{value}</div>
                  </div>
                </li>
              ))}
            </ul>
            {socials.length > 0 && (
              <div className="mt-5 flex items-center gap-3">
                <span className="text-sm font-semibold text-muted">{t('contact.social')}</span>
                {socials.map(({ href, icon: Icon, label }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="flex size-10 items-center justify-center rounded-full bg-navy text-white transition hover:bg-gold hover:text-navy" aria-label={label}>
                    <Icon className="size-4" />
                  </a>
                ))}
              </div>
            )}
            <div className="mt-8">
              <PropertyMap markers={[{ id: 'agency', lat: s.agency.lat, lng: s.agency.lng, title: name }]} zoom={15} height={280} fit={false} />
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="rounded-[22px] border border-line bg-white p-6 shadow-card md:p-8">
              <h2 className="font-display text-2xl text-navy">{t('contact.formTitle')}</h2>
              <div className="mt-5">
                <LeadForm kind="contact" buildMeta={(fd) => ({ subject: fd.get('subject') })}>
                  <Field label={t('contact.subject')}>
                    <Select name="subject" defaultValue="buy">
                      <option value="buy">{t('contact.subject.buy')}</option>
                      <option value="rent">{t('contact.subject.rent')}</option>
                      <option value="sell">{t('contact.subject.sell')}</option>
                      <option value="other">{t('contact.subject.other')}</option>
                    </Select>
                  </Field>
                </LeadForm>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
