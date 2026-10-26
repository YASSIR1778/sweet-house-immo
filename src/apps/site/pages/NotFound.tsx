import { ButtonLink } from '@/shared/ui/base'
import { LogoMark } from '@/shared/ui/logo'
import { usePageMeta, useSite } from '../site'

export function NotFound() {
  const { t, name } = useSite()
  usePageMeta(`${t('common.notFound')} | ${name}`)
  return (
    <div className="mx-auto max-w-2xl px-4 pt-40 pb-28 text-center">
      <LogoMark className="mx-auto size-16" />
      <div className="num font-display mt-6 text-7xl text-gold">404</div>
      <h1 className="font-display mt-2 text-3xl text-navy">{t('common.notFound')}</h1>
      <p className="mt-2 text-muted">{t('common.notFoundText')}</p>
      <ButtonLink to="/" variant="gold" className="mt-8">
        {t('common.goHome')}
      </ButtonLink>
    </div>
  )
}
