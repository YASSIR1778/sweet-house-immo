import { cn } from './base'

/** Brand mark: a Moroccan horseshoe arch sheltering a house, gold on navy. */
export function LogoMark({ className, inverted }: { className?: string; inverted?: boolean }) {
  const bg = inverted ? '#ffffff' : '#0b1b33'
  const fg = inverted ? '#0b1b33' : '#c9a24b'
  return (
    <svg viewBox="0 0 64 64" className={cn('size-10', className)} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill={bg} />
      <path d="M14 50V30c0-10 8-18 18-18s18 8 18 18v20" fill="none" stroke={fg} strokeWidth="3" strokeLinecap="round" />
      <path d="M32 28l-9 8v12h18V36z" fill="none" stroke={fg} strokeWidth="2.6" strokeLinejoin="round" />
      <rect x="29" y="40" width="6" height="8" rx="1" fill={fg} />
      <path d="M12 50h40" stroke={fg} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="32" cy="20" r="2" fill={fg} />
    </svg>
  )
}

export function Logo({ name, sub, light, className, size = 'md' }: { name: string; sub?: string; light?: boolean; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const mark = { sm: 'size-9', md: 'size-11', lg: 'size-14' }[size]
  const text = { sm: 'text-base', md: 'text-lg', lg: 'text-2xl' }[size]
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <LogoMark className={mark} />
      <span className="flex flex-col leading-tight">
        <span className={cn('font-display', text, light ? 'text-white' : 'text-navy')}>{name}</span>
        {sub && <span className={cn('text-[0.7rem] font-semibold tracking-[0.18em] uppercase', light ? 'text-gold-300' : 'text-gold-600')}>{sub}</span>}
      </span>
    </span>
  )
}
