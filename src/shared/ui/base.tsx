import { clsx, type ClassValue } from 'clsx'
import { Loader2, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Link } from 'react-router'

export function cn(...c: ClassValue[]) {
  return clsx(c)
}

/* ------------------------------------------------------------------ */
/* Buttons                                                              */
/* ------------------------------------------------------------------ */
type Variant = 'primary' | 'gold' | 'outline' | 'ghost' | 'light' | 'danger' | 'whatsapp' | 'subtle'
type Size = 'sm' | 'md' | 'lg' | 'xl'

const V: Record<Variant, string> = {
  primary: 'bg-navy text-white hover:bg-navy-800 shadow-soft',
  gold: 'bg-gold text-navy-950 hover:bg-gold-400 shadow-gold font-bold',
  outline: 'border border-navy/25 text-navy hover:bg-navy/5',
  ghost: 'text-navy hover:bg-navy/5',
  light: 'bg-white/15 text-white border border-white/30 hover:bg-white/25 backdrop-blur',
  danger: 'bg-danger text-white hover:brightness-110',
  whatsapp: 'bg-[#25D366] text-white hover:brightness-105 shadow-soft',
  subtle: 'bg-sand text-navy hover:bg-sand-2',
}
const S: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-5 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2 rounded-2xl',
  xl: 'h-14 px-8 text-base gap-2.5 rounded-2xl',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: ClassValue) {
  return cn(
    'inline-flex items-center justify-center font-semibold whitespace-nowrap transition-all duration-200 select-none',
    'active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
    V[variant],
    S[size],
    extra,
  )
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

export function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

export function ButtonLink({ to, variant = 'primary', size = 'md', icon, className, children, external }: { to: string; variant?: Variant; size?: Size; icon?: ReactNode; className?: string; children: ReactNode; external?: boolean }) {
  const cls = buttonClass(variant, size, className)
  if (external)
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" className={cls}>
        {icon}
        {children}
      </a>
    )
  return (
    <Link to={to} className={cls}>
      {icon}
      {children}
    </Link>
  )
}

export function IconButton({ className, children, label, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button aria-label={label} title={label} className={cn('inline-flex size-10 items-center justify-center rounded-full transition-colors hover:bg-navy/5 active:scale-95', className)} {...rest}>
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Form fields                                                          */
/* ------------------------------------------------------------------ */
export function Field({ label, hint, error, children, className, required }: { label?: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={cn('block', className)}>
      {label && (
        <span className="label">
          {label}
          {required && <span className="text-danger"> *</span>}
        </span>
      )}
      {children}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : hint ? <span className="mt-1 block text-xs text-subtle">{hint}</span> : null}
    </label>
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('input', className)} {...rest} />
}
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('input min-h-[110px] resize-y', className)} {...rest} />
}
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn('input input-select', className)} {...rest}>
      {children}
    </select>
  )
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className="inline-flex items-center gap-3 text-sm disabled:cursor-not-allowed disabled:opacity-50">
      <span className={cn('relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-teal' : 'bg-line-2')}>
        <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', checked ? 'ltr:left-[22px] rtl:right-[22px]' : 'ltr:left-0.5 rtl:right-0.5')} />
      </span>
      {label && <span>{label}</span>}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Badges, misc                                                         */
/* ------------------------------------------------------------------ */
export type Tone = 'navy' | 'gold' | 'teal' | 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'white'
const T: Record<Tone, string> = {
  navy: 'bg-navy text-white',
  gold: 'bg-gold text-navy-950',
  teal: 'bg-teal text-white',
  neutral: 'bg-sand text-navy',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
  white: 'bg-white/90 text-navy',
}
export function Badge({ tone = 'neutral', className, children, dot }: { tone?: Tone; className?: string; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none', T[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-6 animate-spin text-gold', className)} />
}

export function FullSpinner() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner className="size-8" />
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-xl', className)} />
}

export function EmptyState({ icon, title, text, action, className }: { icon?: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-3xl border border-dashed border-line-2 bg-white/60 px-6 py-14 text-center', className)}>
      {icon && <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-sand text-gold-600">{icon}</div>}
      <h3 className="text-lg font-bold text-navy">{title}</h3>
      {text && <p className="mt-1 max-w-md text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Reveal on scroll                                                     */
/* ------------------------------------------------------------------ */
export function Reveal({ children, className, delay = 0, as: Tag = 'div' }: { children: ReactNode; className?: string; delay?: number; as?: 'div' | 'section' | 'li' | 'article' }) {
  const ref = useRef<HTMLElement | null>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || shown) return
    if (!('IntersectionObserver' in window)) {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown])
  const Comp = Tag as unknown as 'div'
  return (
    <Comp ref={ref as never} className={cn('reveal', shown && 'in', className)} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </Comp>
  )
}

/* ------------------------------------------------------------------ */
/* Modal / Drawer                                                       */
/* ------------------------------------------------------------------ */
function useLockBody(open: boolean) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])
}

export function Modal({ open, onClose, title, children, footer, size = 'md', className }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  useLockBody(open)
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  const w = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size]
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="anim-fade absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('anim-pop relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-pop sm:rounded-3xl', w, className)}>
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold text-navy">{title}</h2>
          <IconButton label="close" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-ivory px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function Drawer({ open, onClose, title, children, footer, width = 'max-w-xl' }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; width?: string }) {
  useLockBody(open)
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex" role="dialog" aria-modal="true">
      <div className="anim-fade absolute inset-0 bg-navy-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn('anim-up relative ms-auto flex h-full w-full flex-col bg-white shadow-pop', width)}>
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold text-navy">{title}</h2>
          <IconButton label="close" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-ivory px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Confirm dialog (promise based)                                       */
/* ------------------------------------------------------------------ */
interface ConfirmOpts {
  title: ReactNode
  text?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}
type ConfirmFn = (opts: ConfirmOpts) => Promise<boolean>
const ConfirmCtx = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null)
  const confirm = useCallback<ConfirmFn>((opts) => new Promise((resolve) => setState({ ...opts, resolve })), [])
  const close = (v: boolean) => {
    state?.resolve(v)
    setState(null)
  }
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(state)}
        onClose={() => close(false)}
        title={state?.title}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              {state?.cancelLabel ?? 'إلغاء'}
            </Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
              {state?.confirmLabel ?? 'تأكيد'}
            </Button>
          </>
        }
      >
        {state?.text && <p className="text-sm text-muted">{state.text}</p>}
      </Modal>
    </ConfirmCtx.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const c = useContext(ConfirmCtx)
  if (!c) throw new Error('useConfirm outside provider')
  return c
}

/* ------------------------------------------------------------------ */
/* Tabs (segmented)                                                     */
/* ------------------------------------------------------------------ */
export function Segmented<T extends string>({ value, onChange, options, className, dark }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: ReactNode }[]; className?: string; dark?: boolean }) {
  return (
    <div className={cn('inline-flex rounded-2xl p-1', dark ? 'bg-white/10' : 'bg-sand', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all',
            value === o.value ? (dark ? 'bg-gold text-navy-950 shadow' : 'bg-white text-navy shadow-soft') : dark ? 'text-white/80 hover:text-white' : 'text-muted hover:text-navy',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}
