import { Clock, Globe, Heart, LockKeyhole, Mail, MapPin, Menu, Phone, X } from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { PROPERTY_TYPES } from '@/shared/lib/config'
import { fmtPhone, pick, telLink, waLink } from '@/shared/lib/format'
import { LANGS } from '@/shared/lib/i18n'
import { isConfigured } from '@/shared/lib/supabase'
import { FullSpinner, cn } from '@/shared/ui/base'
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from '@/shared/ui/icons'
import { Logo, LogoMark } from '@/shared/ui/logo'
import { WhatsAppFab } from './components'
import { useFavorites, useScrolled, useSite } from './site'

export function LangSwitch({ light }: { light?: boolean }) {
  const { lang, setLang, t } = useSite()
  return (
    <div className={cn('inline-flex items-center rounded-full p-0.5 text-xs font-bold', light ? 'bg-white/15 text-white' : 'bg-navy/5 text-navy')} aria-label={t('common.langAuto')}>
      <Globe className="mx-1.5 size-3.5 opacity-70" />
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          className={cn('rounded-full px-2.5 py-1 transition', lang === l.code ? (light ? 'bg-white text-navy' : 'bg-navy text-white') : 'opacity-75 hover:opacity-100')}
          lang={l.code}
          title={l.label}
        >
          {l.code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

function Header() {
  const { s, lang, t, name } = useSite()
  const loc = useLocation()
  const scrolled = useScrolled(40)
  const [open, setOpen] = useState(false)
  const { ids } = useFavorites()
  const isHome = loc.pathname === '/' || loc.pathname === ''
  const transparent = isHome && !scrolled && !open
  useEffect(() => setOpen(false), [loc.pathname, loc.search])

  const links = [
    { to: '/', label: t('nav.home'), phone: true },
    { to: '/biens?purpose=sale', label: t('nav.sale') },
    { to: '/biens?purpose=rent', label: t('nav.rent') },
    { to: '/sejours', label: t('nav.stays') },
    { to: '/vendre', label: t('nav.sell'), short: t('nav.sellShort') },
    { to: '/mre', label: t('nav.mre') },
    { to: '/agence', label: t('nav.agency') },
    { to: '/contact', label: t('nav.contact') },
  ]
  const active = (to: string) => {
    const [path, qs] = to.split('?')
    if (path !== loc.pathname) return false
    if (!qs) return true
    return loc.search.includes(qs)
  }

  return (
    <header className={cn('no-print fixed inset-x-0 top-0 z-50 transition-all duration-300', transparent ? 'bg-transparent py-3' : 'glass py-1.5 shadow-soft')}>
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 md:px-6 2xl:gap-4">
        <Link to="/" className="shrink-0" aria-label={name}>
          <Logo name={name} sub={lang === 'ar' ? 'Sweet House Immobilier' : 'Tétouan · Martil · M’diq'} light={transparent} size="md" />
        </Link>
        <nav className="hidden items-center xl:flex 2xl:gap-0.5">
          {links.filter((l) => !l.phone).map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                'rounded-full px-2 py-2 text-[13px] font-semibold whitespace-nowrap transition 2xl:px-3 2xl:text-sm',
                transparent ? 'text-white/85 hover:bg-white/10 hover:text-white' : 'text-navy/80 hover:bg-navy/5 hover:text-navy',
                active(l.to) && (transparent ? 'bg-white/15 text-white' : 'bg-navy/5 text-navy'),
              )}
            >
              {l.short ?? l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <LangSwitch light={transparent} />
          </div>
          <Link to="/favoris" className={cn('relative hidden size-10 items-center justify-center rounded-full transition sm:inline-flex', transparent ? 'text-white hover:bg-white/10' : 'text-navy hover:bg-navy/5')} aria-label={t('nav.favorites')}>
            <Heart className={cn('size-5', ids.length && 'fill-danger text-danger')} />
            {ids.length > 0 && <span className="num absolute -top-0.5 -end-0.5 flex size-5 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-navy-950">{ids.length}</span>}
          </Link>
          <a href={telLink(s.agency.phone)} className={cn('hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition', lang === 'ar' && '2xl:inline-flex', transparent ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-navy/5 text-navy hover:bg-navy/10')}>
            <Phone className="size-4" />
            <span className="num" dir="ltr">
              {fmtPhone(s.agency.phone)}
            </span>
          </a>
          <a href={waLink(s.agency.whatsapp)} target="_blank" rel="noopener noreferrer" className="hidden items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-bold text-navy-950 shadow-gold transition hover:bg-gold-400 md:inline-flex">
            <WhatsAppIcon className="size-4" /> <span className={cn('xl:hidden', lang === 'ar' && '2xl:inline')}>{t('nav.whatsapp')}</span>
          </a>
          <button onClick={() => setOpen(!open)} className={cn('inline-flex size-10 items-center justify-center rounded-full xl:hidden', transparent ? 'text-white' : 'text-navy')} aria-label={t('nav.menu')} aria-expanded={open}>
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="anim-fade xl:hidden">
          <div className="mx-auto max-w-7xl px-4 pt-2 pb-5">
            <nav className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-white shadow-card">
              {links.map((l) => (
                <Link key={l.to} to={l.to} className={cn('px-5 py-3.5 text-[15px] font-semibold text-navy', active(l.to) && 'text-gold-700')}>
                  {l.label}
                </Link>
              ))}
              <Link to="/favoris" className="flex items-center gap-2 px-5 py-3.5 text-[15px] font-semibold text-navy">
                <Heart className="size-4" /> {t('nav.favorites')} {ids.length ? <span className="num text-xs text-muted">({ids.length})</span> : null}
              </Link>
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <LangSwitch />
                <a href={waLink(s.agency.whatsapp)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-bold text-navy-950">
                  <WhatsAppIcon className="size-4" /> {t('nav.whatsapp')}
                </a>
              </div>
            </nav>
          </div>
        </div>
      )}
    </header>
  )
}

function Footer() {
  const { s, lang, t, name, typeName } = useSite()
  const year = new Date().getFullYear()
  const socials = [
    { href: s.agency.facebook, icon: FacebookIcon, label: 'Facebook' },
    { href: s.agency.instagram, icon: InstagramIcon, label: 'Instagram' },
    { href: s.agency.tiktok, icon: TikTokIcon, label: 'TikTok' },
  ].filter((x) => x.href)
  return (
    <footer className="no-print relative mt-24 overflow-hidden bg-navy text-white">
      <div className="zellige absolute inset-0 opacity-[0.06]" />
      <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-8 md:px-6">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo name={name} sub="Immobilier · Tétouan" light size="lg" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/70">{pick(s.agency.about, lang)}</p>
            <div className="mt-5 flex gap-2">
              {socials.map(({ href, icon: Icon, label }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="flex size-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-gold hover:text-navy" aria-label={label}>
                  <Icon className="size-4" />
                </a>
              ))}
              <a href={waLink(s.agency.whatsapp)} target="_blank" rel="noopener noreferrer" className="flex size-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-[#25D366]" aria-label="WhatsApp">
                <WhatsAppIcon className="size-4" />
              </a>
            </div>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-bold tracking-[0.18em] text-gold-300 uppercase">{t('footer.links')}</h4>
            <ul className="space-y-2.5 text-sm text-white/80">
              <li>
                <Link to="/biens?purpose=sale" className="hover:text-gold-300">
                  {t('nav.sale')}
                </Link>
              </li>
              <li>
                <Link to="/biens?purpose=rent" className="hover:text-gold-300">
                  {t('nav.rent')}
                </Link>
              </li>
              <li>
                <Link to="/sejours" className="hover:text-gold-300">
                  {t('nav.stays')}
                </Link>
              </li>
              <li>
                <Link to="/vendre" className="hover:text-gold-300">
                  {t('nav.sell')}
                </Link>
              </li>
              <li>
                <Link to="/estimation" className="hover:text-gold-300">
                  {t('nav.estimate')}
                </Link>
              </li>
              <li>
                <Link to="/marche" className="hover:text-gold-300">
                  {t('nav.market')}
                </Link>
              </li>
              <li>
                <Link to="/frais" className="hover:text-gold-300">
                  {t('nav.calc')}
                </Link>
              </li>
              <li>
                <Link to="/mre" className="hover:text-gold-300">
                  {t('nav.mre')}
                </Link>
              </li>
              <li>
                <Link to="/agence" className="hover:text-gold-300">
                  {t('nav.agency')}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-gold-300">
                  {t('nav.contact')}
                </Link>
              </li>
              <li>
                <Link to="/favoris" className="hover:text-gold-300">
                  {t('nav.favorites')}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-bold tracking-[0.18em] text-gold-300 uppercase">{t('footer.types')}</h4>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm text-white/80">
              {PROPERTY_TYPES.slice(0, 10).map((ty) => (
                <li key={ty}>
                  <Link to={`/biens?type=${ty}`} className="hover:text-gold-300">
                    {typeName(ty, true)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-bold tracking-[0.18em] text-gold-300 uppercase">{t('footer.contact')}</h4>
            <ul className="space-y-3 text-sm text-white/80">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-gold" /> {pick(s.agency.address, lang)}
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="size-4 shrink-0 text-gold" />
                <a href={telLink(s.agency.phone)} className="num hover:text-gold-300" dir="ltr">
                  {fmtPhone(s.agency.phone)}
                </a>
              </li>
              {s.agency.email && (
                <li className="flex items-center gap-2.5">
                  <Mail className="size-4 shrink-0 text-gold" />
                  <a href={`mailto:${s.agency.email}`} className="hover:text-gold-300" dir="ltr">
                    {s.agency.email}
                  </a>
                </li>
              )}
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 size-4 shrink-0 text-gold" /> <span className="num">{pick(s.agency.hours, lang)}</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="rule-gold mt-12 opacity-60" />
        <div className="mt-6 flex flex-col items-center justify-between gap-3 text-xs text-white/55 md:flex-row">
          <p>
            © <span className="num">{year}</span> {name} — {t('footer.rights')}
          </p>
          <p className="text-center">{t('footer.photo')}: Ideophagous, CC BY-SA 4.0, Wikimedia Commons</p>
          <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-white/70 transition hover:border-gold hover:text-gold-300">
            <LockKeyhole className="size-3.5" /> {t('nav.admin')}
          </Link>
        </div>
      </div>
    </footer>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}

export function SiteLayout() {
  const { lang, dir, t } = useSite()
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
  }, [lang, dir])
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Header />
      <main className="flex-1">
        <Suspense fallback={<FullSpinner />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <WhatsAppFab />
      {!isConfigured && (
        <div className="no-print fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-2 bg-navy-950/90 px-3 py-1.5 text-center text-[11px] text-white/80 backdrop-blur">
          <LogoMark className="size-4" /> {t('common.demo')}
        </div>
      )}
    </div>
  )
}
