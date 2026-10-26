import { Bell, BellOff, BellRing, Send, Share, Smartphone, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button, Modal, cn } from '@/shared/ui/base'
import { disablePush, enablePush, isIos, PushError, pushKey, pushState, testPush, type PushState } from './push'

const HINT_KEY = 'shi:push-hint'

export function usePushState() {
  const [state, setState] = useState<PushState | null>(null)
  const refresh = useCallback(() => {
    pushState()
      .then(setState)
      .catch(() => setState('unsupported'))
  }, [])
  useEffect(() => refresh(), [refresh])
  return { state, refresh }
}

const failText = (e: unknown) => (e instanceof PushError ? e.message : 'تعذر تشغيل الإشعارات. أعد المحاولة بعد قليل.')

/** Turn this device's notifications on or off, and try them. */
export function NotificationsDialog({ open, onClose, onChange }: { open: boolean; onClose: () => void; onChange?: () => void }) {
  const { state, refresh } = usePushState()
  const [busy, setBusy] = useState<'on' | 'off' | 'test' | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (!open) return
    refresh()
    // is the service installed on the server? (its first call also prepares it)
    pushState()
      .then((s) => (s === 'demo' ? undefined : pushKey()))
      .then(() => setMissing(false))
      .catch((e) => setMissing(e instanceof PushError && e.code === 'not_installed'))
  }, [open, refresh])

  const run = async (what: 'on' | 'off' | 'test') => {
    setBusy(what)
    try {
      if (what === 'on') {
        await enablePush()
        toast.success('فُعّلت الإشعارات على هذا الجهاز')
      } else if (what === 'off') {
        await disablePush()
        toast.success('أُوقفت الإشعارات على هذا الجهاز')
      } else {
        const r = await testPush()
        if (r.sent > 0) toast.success('أُرسل إشعار تجريبي: يجب أن يظهر خلال ثوانٍ')
        else toast.error('لم يُرسَل شيء: أوقف الإشعارات ثم فعّلها من جديد على هذا الجهاز')
      }
    } catch (e) {
      toast.error(failText(e))
    } finally {
      setBusy(null)
      refresh()
      onChange?.()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="إشعارات الطلبات على هذا الجهاز">
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted">
          يصلك إشعار فوري كلما أرسل زائر طلباً من الموقع: استفسار، طلب زيارة، حجز موسمي، مالك يعرض عقاره… حتى لو كانت لوحة التحكم مغلقة. يُشفَّر كل إشعار لجهازك وحده.
        </p>

        {state === 'on' || state === 'off' ? (
          <div className={cn('flex items-center gap-3 rounded-2xl p-4', state === 'on' ? 'bg-success/10 text-success' : 'bg-sand text-navy')}>
            {state === 'on' ? <BellRing className="size-6 shrink-0" /> : <BellOff className="size-6 shrink-0" />}
            <div className="flex-1 text-sm font-bold">{state === 'on' ? 'الإشعارات مفعّلة على هذا الجهاز' : 'الإشعارات غير مفعّلة على هذا الجهاز'}</div>
          </div>
        ) : null}

        {missing && <p className="rounded-xl bg-warning/10 p-3 text-sm text-warning">خدمة الإشعارات غير مثبتة بعد على الخادم.</p>}

        {state === 'off' && (
          <Button variant="gold" size="lg" className="w-full" loading={busy === 'on'} disabled={missing} icon={<Bell className="size-5" />} onClick={() => void run('on')}>
            تفعيل الإشعارات على هذا الجهاز
          </Button>
        )}
        {state === 'on' && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="primary" loading={busy === 'test'} icon={<Send className="size-4" />} onClick={() => void run('test')}>
              إرسال إشعار تجريبي
            </Button>
            <Button variant="outline" loading={busy === 'off'} icon={<BellOff className="size-4" />} onClick={() => void run('off')}>
              إيقاف على هذا الجهاز
            </Button>
          </div>
        )}

        {state === 'ios-install' && (
          <div className="space-y-2 rounded-2xl border border-gold/40 bg-gold/5 p-4 text-sm text-navy">
            <div className="font-bold">على الآيفون تعمل الإشعارات من تطبيق لوحة التحكم:</div>
            <ol className="list-inside list-decimal space-y-1.5 text-muted">
              <li>افتح لوحة التحكم في متصفح Safari.</li>
              <li>
                اضغط زر المشاركة <Share className="inline size-4 align-text-bottom text-navy" /> ثم «إضافة إلى الشاشة الرئيسية».
              </li>
              <li>افتح «سويت هاوس» من الشاشة الرئيسية، ثم فعّل الإشعارات من هذا الزر.</li>
            </ol>
            <div className="text-xs text-subtle">يلزم iOS 16.4 أو أحدث.</div>
          </div>
        )}
        {state === 'denied' && (
          <div className="rounded-2xl bg-warning/10 p-4 text-sm text-warning">
            سبق أن رُفضت الإشعارات لهذا الموقع على هذا الجهاز.{' '}
            {isIos() ? 'افتح الإعدادات ← الإشعارات ← سويت هاوس، وفعّل «السماح بالإشعارات».' : 'افتح إعدادات المتصفح ← إعدادات المواقع ← الإشعارات، واسمح لهذا الموقع.'} ثم أعد فتح هذه النافذة.
          </div>
        )}
        {state === 'unsupported' && <p className="rounded-2xl bg-sand p-4 text-sm text-navy">هذا المتصفح لا يدعم الإشعارات. على أندرويد استعمل Chrome، وعلى الآيفون أضف لوحة التحكم إلى الشاشة الرئيسية.</p>}
        {state === 'demo' && <p className="rounded-2xl bg-sand p-4 text-sm text-navy">الإشعارات تعمل في النسخة الحقيقية المتصلة بقاعدة البيانات فقط.</p>}

        <p className="flex items-start gap-2 text-xs leading-relaxed text-subtle">
          <Smartphone className="mt-0.5 size-4 shrink-0" />
          فعّلها على كل جهاز تريد أن يصلك عليه الإشعار. كل عضو في الفريق يفعّلها على هاتفه من زر الجرس أسفل القائمة.
        </p>
      </div>
    </Modal>
  )
}

/** The bell under the menu: shows whether this device gets the notifications. */
export function NotificationsButton() {
  const { state, refresh } = usePushState()
  const [open, setOpen] = useState(false)
  const attention = state === 'off' || state === 'ios-install'
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"
        title="إشعارات الطلبات على هذا الجهاز"
        aria-label="إشعارات الطلبات على هذا الجهاز"
      >
        {state === 'on' ? <BellRing className="size-4 text-gold-300" /> : <Bell className="size-4" />}
        {attention && <span className="absolute top-1.5 end-1.5 size-2 rounded-full bg-gold" />}
      </button>
      <NotificationsDialog open={open} onClose={() => setOpen(false)} onChange={refresh} />
    </>
  )
}

/** On the desk: an invitation to turn them on for this phone, until done or dismissed. */
export function PushHint() {
  const { state, refresh } = usePushState()
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HINT_KEY) === 'hidden'
    } catch {
      return false
    }
  })
  if (hidden || !(state === 'off' || state === 'ios-install')) return null
  const hide = () => {
    setHidden(true)
    try {
      localStorage.setItem(HINT_KEY, 'hidden')
    } catch {
      /* private mode */
    }
  }
  return (
    <>
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold/5 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/20 text-gold-700">
          <BellRing className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-navy">فعّل إشعارات الطلبات على هذا الجهاز</div>
          <div className="text-xs text-muted">ليصلك كل طلب من الموقع فور وصوله، حتى ولو كانت لوحة التحكم مغلقة.</div>
        </div>
        <Button size="sm" variant="gold" onClick={() => setOpen(true)}>
          تفعيل
        </Button>
        <button onClick={hide} className="rounded-full p-1.5 text-subtle hover:bg-sand" aria-label="لاحقاً" title="لاحقاً">
          <X className="size-4" />
        </button>
      </div>
      <NotificationsDialog open={open} onClose={() => setOpen(false)} onChange={refresh} />
    </>
  )
}
