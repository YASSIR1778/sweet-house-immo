import { Heart } from 'lucide-react'
import { WhatsAppIcon } from '@/shared/ui/icons'
import { useMemo } from 'react'
import { usePublicProperties } from '@/shared/lib/data'
import { fmtPrice, waLink } from '@/shared/lib/format'
import { ButtonLink, EmptyState } from '@/shared/ui/base'
import { PageHero, PropertyCard } from '../components'
import { propertyTitle, propertyUrl, useFavorites, usePageMeta, useSite } from '../site'

export function Favorites() {
  const { s, lang, t, name } = useSite()
  usePageMeta(`${t('fav.title')} | ${name}`)
  const { ids } = useFavorites()
  const { data } = usePublicProperties()
  const list = useMemo(() => (data ?? []).filter((p) => ids.includes(p.id)), [data, ids])
  const text =
    ({ ar: 'السلام عليكم، هذه قائمة العقارات التي تهمني:\n', fr: 'Bonjour, voici les biens qui m’intéressent :\n', es: 'Hola, estos son los inmuebles que me interesan:\n', en: 'Hello, here are the properties I am interested in:\n' }[lang]) +
    list.map((p) => `• ${p.ref} — ${propertyTitle(p, lang)} — ${fmtPrice(p.price, lang, p.purpose === 'rent')}\n${propertyUrl(p)}`).join('\n')
  return (
    <>
      <PageHero compact eyebrow={t('nav.favorites')} title={t('fav.title')} text={t('list.results', { n: list.length })} />
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        {list.length === 0 ? (
          <EmptyState icon={<Heart className="size-7" />} title={t('fav.empty')} action={<ButtonLink to="/biens" variant="gold">{t('fav.browse')}</ButtonLink>} />
        ) : (
          <>
            <div className="mb-6 flex justify-end">
              <ButtonLink to={waLink(s.agency.whatsapp, text)} external variant="whatsapp" icon={<WhatsAppIcon className="size-4" />}>
                {t('fav.shareAll')}
              </ButtonLink>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((p) => (
                <PropertyCard key={p.id} p={p} />
              ))}
            </div>
          </>
        )}
      </section>
    </>
  )
}
