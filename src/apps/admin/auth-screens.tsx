import { ArrowRight, Building2, CalendarCheck, Crown, Headset, KeyRound, LineChart, LogOut, RefreshCw, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '@/shared/lib/auth'
import { DEFAULT_SETTINGS } from '@/shared/lib/config'
import { getSupabase } from '@/shared/lib/supabase'
import { Button, Field, Input } from '@/shared/ui/base'
import { Logo } from '@/shared/ui/logo'

function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 min-h-screen bg-ivory lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-navy lg:block">
        <img src={DEFAULT_SETTINGS.site.hero_image} alt="" className="anim-kenburns absolute inset-0 h-full w-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy/70 to-navy/30" />
        <div className="zellige absolute inset-0 opacity-[0.07]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Logo name="سويت هاوس للعقار" sub="Sweet House Immobilier" light size="lg" />
          <div>
            <h2 className="font-display text-5xl leading-tight">كل الوكالة في مكان واحد</h2>
            <p className="mt-4 max-w-md text-lg text-white/75">العقارات، الطلبات، المواعيد، العملاء والعمولات — منظمة ومتابعة لحظة بلحظة.</p>
            <ul className="mt-8 grid max-w-md gap-3 text-sm text-white/85">
              <li className="flex items-center gap-3">
                <Building2 className="size-5 text-gold" /> إدارة العقارات ونشرها على الموقع بضغطة
              </li>
              <li className="flex items-center gap-3">
                <CalendarCheck className="size-5 text-gold" /> أجندة الزيارات وأوراق الزيارة الجاهزة للطباعة
              </li>
              <li className="flex items-center gap-3">
                <LineChart className="size-5 text-gold" /> أرقام الوكالة والعمولات وأداء الفريق
              </li>
            </ul>
          </div>
          <p className="text-xs text-white/40">Tétouan · Martil · M’diq · Cabo Negro</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-5 md:p-10">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  )
}

function authError(err: string): string {
  if (/invalid login credentials|invalid/i.test(err)) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
  if (/email not confirmed/i.test(err)) return 'أكّد بريدك الإلكتروني أولاً من الرسالة التي وصلتك، ثم سجّل الدخول.'
  if (/signups? not allowed|signup.*disabled/i.test(err)) return 'إنشاء الحسابات من هنا مغلق. اطلب من المدير إنشاء حسابك من لوحة Supabase، ثم سجّل الدخول.'
  if (/rate limit|too many/i.test(err)) return 'محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة.'
  return err
}

export function Login() {
  const { mode, demoSignIn, signIn, signUp, resetPassword } = useAuth()
  const [view, setView] = useState<'login' | 'signup' | 'reset'>('login')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [f, setF] = useState({ name: '', email: '', password: '' })

  if (mode === 'demo')
    return (
      <AuthFrame>
        <div className="lg:hidden">
          <Logo name="سويت هاوس للعقار" sub="Sweet House Immobilier" size="md" />
        </div>
        <h1 className="font-display mt-8 text-3xl text-navy lg:mt-0">مرحباً بك في لوحة التحكم</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">هذه نسخة تجريبية تعمل ببيانات نموذجية محفوظة على هذا الجهاز فقط. جرّب الدورين:</p>
        <div className="mt-6 grid gap-3">
          <button onClick={() => demoSignIn('admin')} className="group flex items-start gap-4 rounded-2xl border border-line bg-white p-5 text-start shadow-soft transition hover:-translate-y-0.5 hover:border-gold hover:shadow-card">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-navy text-gold">
              <Crown className="size-6" />
            </span>
            <span>
              <span className="block text-lg font-bold text-navy">الدخول كمدير</span>
              <span className="mt-0.5 block text-sm text-muted">لوحة القيادة، الأرقام، العمولات، الفريق، سجل النشاط والإعدادات</span>
            </span>
          </button>
          <button onClick={() => demoSignIn('secretary')} className="group flex items-start gap-4 rounded-2xl border border-line bg-white p-5 text-start shadow-soft transition hover:-translate-y-0.5 hover:border-gold hover:shadow-card">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-teal text-white">
              <Headset className="size-6" />
            </span>
            <span>
              <span className="block text-lg font-bold text-navy">الدخول ككاتبة</span>
              <span className="mt-0.5 block text-sm text-muted">المكتب اليومي: المكالمات، المواعيد، الطلبات، العملاء والمهام</span>
            </span>
          </button>
        </div>
        <Link to="/" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-navy">
          <ArrowRight className="size-4" /> العودة إلى الموقع
        </Link>
      </AuthFrame>
    )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setMsg(null)
    setBusy(true)
    try {
      if (view === 'login') {
        const err = await signIn(f.email, f.password)
        if (err) setMsg(authError(err))
      } else if (view === 'signup') {
        if (f.password.length < 8) return setMsg('كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.')
        const err = await signUp(f.email, f.password, f.name)
        if (err) setMsg(authError(err))
        else setMsg('تم إنشاء الحساب. إن طُلب منك تأكيد البريد الإلكتروني فافتح الرسالة، ثم انتظر تفعيل المدير لحسابك.')
      } else {
        const err = await resetPassword(f.email)
        setMsg(err ? authError(err) : 'أرسلنا لك رابطاً لإعادة تعيين كلمة المرور. تحقق من بريدك.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthFrame>
      <div className="lg:hidden">
        <Logo name="سويت هاوس للعقار" sub="Sweet House Immobilier" size="md" />
      </div>
      <h1 className="font-display mt-8 text-3xl text-navy lg:mt-0">{view === 'login' ? 'تسجيل الدخول' : view === 'signup' ? 'حساب جديد للفريق' : 'استعادة كلمة المرور'}</h1>
      <p className="mt-2 text-sm text-muted">{view === 'signup' ? 'حساب المدير يُفعَّل تلقائياً عند التسجيل ببريده المسجل في الإعداد. باقي الحسابات تنتظر تفعيل المدير.' : 'خاص بفريق الوكالة.'}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {view === 'signup' && (
          <Field label="الاسم الكامل" required>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoComplete="name" />
          </Field>
        )}
        <Field label="البريد الإلكتروني" required>
          <Input type="email" dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required autoComplete="email" />
        </Field>
        {view !== 'reset' && (
          <Field label="كلمة المرور" required>
            <Input type="password" dir="ltr" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required autoComplete={view === 'login' ? 'current-password' : 'new-password'} />
          </Field>
        )}
        {msg && <p className="rounded-xl bg-sand px-3 py-2.5 text-sm text-navy">{msg}</p>}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} icon={<KeyRound className="size-4" />}>
          {view === 'login' ? 'دخول' : view === 'signup' ? 'إنشاء الحساب' : 'إرسال الرابط'}
        </Button>
      </form>
      <div className="mt-5 flex flex-wrap justify-between gap-2 text-sm">
        {view === 'login' ? (
          <>
            <button className="font-semibold text-teal hover:underline" onClick={() => (setView('reset'), setMsg(null))}>
              نسيت كلمة المرور؟
            </button>
            <button className="font-semibold text-navy hover:underline" onClick={() => (setView('signup'), setMsg(null))}>
              عضو جديد؟ أنشئ حساباً
            </button>
          </>
        ) : (
          <button className="font-semibold text-navy hover:underline" onClick={() => (setView('login'), setMsg(null))}>
            ← العودة لتسجيل الدخول
          </button>
        )}
      </div>
      <Link to="/" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-navy">
        <ArrowRight className="size-4" /> العودة إلى الموقع
      </Link>
    </AuthFrame>
  )
}

export function Pending() {
  const { user, signOut, refresh } = useAuth()
  return (
    <AuthFrame>
      <span className="flex size-14 items-center justify-center rounded-2xl bg-gold/15 text-gold-700">
        <ShieldCheck className="size-7" />
      </span>
      <h1 className="font-display mt-6 text-3xl text-navy">حسابك في انتظار التفعيل</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        تم إنشاء حسابك (<span dir="ltr">{user?.email}</span>). أخبر مدير الوكالة ليفعّله من صفحة «الفريق» في لوحة التحكم، ثم اضغط «تحقق مجدداً».
      </p>
      <div className="mt-6 flex gap-2">
        <Button icon={<RefreshCw className="size-4" />} onClick={() => void refresh()}>
          تحقق مجدداً
        </Button>
        <Button variant="ghost" icon={<LogOut className="size-4" />} onClick={() => void signOut()}>
          خروج
        </Button>
      </div>
    </AuthFrame>
  )
}

export function ResetPassword() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  if (!user)
    return (
      <AuthFrame>
        <h1 className="font-display text-3xl text-navy">الرابط غير صالح أو منتهي</h1>
        <p className="mt-2 text-sm text-muted">اطلب رابطاً جديداً من صفحة تسجيل الدخول.</p>
        <Link to="/admin" className="mt-6 inline-block font-semibold text-teal">
          صفحة الدخول
        </Link>
      </AuthFrame>
    )
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (pw.length < 8) return toast.error('8 أحرف على الأقل')
    if (pw !== pw2) return toast.error('كلمتا المرور غير متطابقتين')
    setBusy(true)
    const { error } = await getSupabase().auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return toast.error(error.message)
    toast.success('تم تغيير كلمة المرور')
    nav('/admin')
  }
  return (
    <AuthFrame>
      <h1 className="font-display text-3xl text-navy">كلمة مرور جديدة</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="كلمة المرور الجديدة">
          <Input type="password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="أعد كتابتها">
          <Input type="password" dir="ltr" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          حفظ
        </Button>
      </form>
    </AuthFrame>
  )
}
