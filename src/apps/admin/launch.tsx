import { Check, ChevronDown, Rocket, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/shared/lib/auth'
import { billingMissing } from '@/shared/lib/billing'
import { DEFAULT_SETTINGS } from '@/shared/lib/config'
import { useBilling, useTable } from '@/shared/lib/data'
import { pick } from '@/shared/lib/format'
import type { BillingSettings, Property, PushSub } from '@/shared/lib/types'
import { cn } from '@/shared/ui/base'
import { useLookups, useMe, useNames } from './hooks'

const HIDE_KEY = 'shi:launch-hidden'
const TARGET = 10

interface Step {
  key: string
  done: boolean
  label: string
  hint: string
  to?: string
}

/** What is left before the real site can welcome visitors (the owner's dashboard). */
export function LaunchChecklist() {
  const me = useMe()
  const { mode } = useAuth()
  const live = mode === 'live'
  const { s } = useNames()
  const L = useLookups()
  const { data: billing } = useBilling()
  const { data: props = [] } = useTable<Property>('properties')
  const { data: devices = [] } = useTable<PushSub>('push_subs', { enabled: live })
  const [open, setOpen] = useState(true)
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDE_KEY) === 'yes'
    } catch {
      return false
    }
  })

  const published = props.filter((p) => p.published && p.status !== 'draft').length
  const a = s.agency
  const d = DEFAULT_SETTINGS.agency
  const steps: Step[] = [
    {
      key: 'agency',
      done: a.email !== d.email && pick(a.address, 'ar') !== pick(d.address, 'ar'),
      label: 'معلومات الوكالة الحقيقية',
      hint: 'بريدك الإلكتروني الحقيقي، العنوان الكامل، روابط إنستغرام وتيك توك.',
      to: '/admin/settings',
    },
    {
      key: 'billing',
      done: Boolean(billing) && billingMissing(billing as BillingSettings).length === 0,
      label: 'الهوية القانونية للفواتير',
      hint: 'السجل التجاري، التعريف الضريبي، ICE، الباتانتا: تُطبع في كل فاتورة.',
      to: '/admin/settings?tab=billing',
    },
    {
      key: 'properties',
      done: published >= TARGET,
      label: `العقارات المنشورة: ${Math.min(published, TARGET)} من ${TARGET}`,
      hint: 'أضف عقاراتك بصور جيدة، ثم اضغط «اكتب العنوان والوصف تلقائياً» فيُكتب بأربع لغات.',
      to: '/admin/properties/new',
    },
    {
      key: 'team',
      done: L.activeStaff.length >= 2,
      label: 'حساب الكاتبة أو الفريق',
      hint: 'كل عضو يدخل بحسابه وصلاحياته، ويُسجَّل عمله باسمه.',
      to: '/admin/team',
    },
    ...(live
      ? [
          {
            key: 'push',
            done: devices.some((x) => x.staff_id === me.id),
            label: 'إشعارات الطلبات على هاتفك',
            hint: 'من زر الجرس أسفل القائمة، على هاتفك (على الآيفون بعد إضافة لوحة التحكم إلى الشاشة الرئيسية).',
          },
        ]
      : []),
    {
      key: 'review',
      done: Boolean(a.review_url),
      label: 'بطاقة الوكالة على خرائط Google',
      hint: 'أنشئ البطاقة من حساب Google، ثم ضع رابط التقييم في الإعدادات: يُرسل للعملاء بعد كل صفقة.',
      to: '/admin/settings',
    },
    {
      key: 'google',
      done: Boolean(s.site.allow_indexing),
      label: 'إظهار الموقع في Google',
      hint: 'آخر خطوة، بعد العقارات ومعلومات الوكالة: الإعدادات ← الصفحة الرئيسية ← «الظهور في Google».',
      to: '/admin/settings?tab=site',
    },
  ]
  const done = steps.filter((x) => x.done).length
  if (hidden || done === steps.length) return null
  const hide = () => {
    setHidden(true)
    try {
      localStorage.setItem(HIDE_KEY, 'yes')
    } catch {
      /* private mode */
    }
  }
  const pct = Math.round((done / steps.length) * 100)

  return (
    <section className="card mb-6 overflow-hidden border-gold/40">
      <header className="flex items-center gap-3 bg-gold/5 px-5 py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-navy text-gold">
          <Rocket className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold text-navy">قائمة الانطلاق</h2>
          <p className="text-xs text-muted">
            <span className="num">{done}</span> من <span className="num">{steps.length}</span> خطوات · ما بقي قبل أن يستقبل الموقع زواره
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="rounded-full p-2 text-muted hover:bg-sand" aria-label={open ? 'طي' : 'عرض'}>
          <ChevronDown className={cn('size-4 transition', !open && 'rotate-180')} />
        </button>
        <button onClick={hide} className="rounded-full p-2 text-subtle hover:bg-sand" aria-label="إخفاء القائمة" title="إخفاء القائمة">
          <X className="size-4" />
        </button>
      </header>
      {open && (
        <ol className="divide-y divide-line">
          {steps.map((x, i) => {
            const body = (
              <>
                <span className={cn('num flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold', x.done ? 'bg-success text-white' : 'bg-sand text-navy')}>{x.done ? <Check className="size-4" /> : i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm font-semibold', x.done ? 'text-subtle line-through' : 'text-navy')}>{x.label}</span>
                  {!x.done && <span className="block text-xs leading-relaxed text-muted">{x.hint}</span>}
                </span>
              </>
            )
            return (
              <li key={x.key}>
                {x.to && !x.done ? (
                  <Link to={x.to} className="flex items-start gap-3 px-5 py-3 hover:bg-ivory">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 px-5 py-3">{body}</div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
