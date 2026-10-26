import {
  Building2,
  CalendarDays,
  ExternalLink,
  HandCoins,
  Headset,
  History,
  Inbox,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  PhoneCall,
  Plus,
  Search,
  Settings as SettingsIcon,
  ShieldAlert,
  UserCog,
  Users,
  X,
  KeyRound,
  CalendarPlus,
  UserPlus,
  ClipboardPlus,
  PhoneIncoming,
  Building,
  BadgeDollarSign,
  Calculator,
  Handshake,
  type LucideIcon,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '@/shared/lib/auth'
import { useTable } from '@/shared/lib/data'
import { phoneKey, sameDay } from '@/shared/lib/format'
import { I18nProvider } from '@/shared/lib/i18n'
import type { Appointment, Broker, Client, Lead, Permission, Property, Task } from '@/shared/lib/types'
import { Badge, FullSpinner, cn } from '@/shared/ui/base'
import { Logo } from '@/shared/ui/logo'
import { Login, Pending, ResetPassword } from './auth-screens'
import { ChangePasswordDialog } from './change-password'
import { QuickAddProvider, useQuickAdd } from './dialogs'
import { useCan, useMe, useNames } from './hooks'
import { BROKER_KIND, CLIENT_KIND, LEAD_STATUS, ROLE } from './labels'
import { Avatar, DropMenu, Pill } from './ui'

const Activity = lazy(() => import('./pages/Activity').then((m) => ({ default: m.Activity })))
const Agenda = lazy(() => import('./pages/Agenda').then((m) => ({ default: m.Agenda })))
const Brokers = lazy(() => import('./pages/Brokers').then((m) => ({ default: m.Brokers })))
const Calculators = lazy(() => import('./pages/Calculators').then((m) => ({ default: m.Calculators })))
const Calls = lazy(() => import('./pages/Calls').then((m) => ({ default: m.Calls })))
const Clients = lazy(() => import('./pages/Clients').then((m) => ({ default: m.Clients })))
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Deals = lazy(() => import('./pages/Deals').then((m) => ({ default: m.Deals })))
const Desk = lazy(() => import('./pages/Desk').then((m) => ({ default: m.Desk })))
const Leads = lazy(() => import('./pages/Leads').then((m) => ({ default: m.Leads })))
const Properties = lazy(() => import('./pages/Properties').then((m) => ({ default: m.Properties })))
const PropertyEditor = lazy(() => import('./pages/PropertyEditor').then((m) => ({ default: m.PropertyEditor })))
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })))
const Tasks = lazy(() => import('./pages/Tasks').then((m) => ({ default: m.Tasks })))
const Team = lazy(() => import('./pages/Team').then((m) => ({ default: m.Team })))

export default function AdminApp() {
  return (
    <I18nProvider fixed="ar">
      <AdminRoot />
    </I18nProvider>
  )
}

function AdminRoot() {
  const { user, loading, pending } = useAuth()
  useEffect(() => {
    document.documentElement.dir = 'rtl'
    document.documentElement.lang = 'ar'
    document.title = 'لوحة التحكم — سويت هاوس للعقار'
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (!robots) {
      robots = document.createElement('meta')
      robots.name = 'robots'
      document.head.appendChild(robots)
    }
    robots.content = 'noindex, nofollow'
    return () => robots?.remove()
  }, [])
  if (loading) return <FullSpinner />
  return (
    <Routes>
      <Route path="reset" element={<ResetPassword />} />
      <Route
        path="*"
        element={
          !user ? (
            <Login />
          ) : pending ? (
            <Pending />
          ) : (
            <QuickAddProvider>
              <Shell />
            </QuickAddProvider>
          )
        }
      />
    </Routes>
  )
}

/* ------------------------------------------------------------------ */
interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  badge?: number
  tone?: 'gold' | 'danger' | 'teal'
}

function SideNav({ groups, onNavigate }: { groups: { title?: string; items: NavItem[] }[]; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-6">
      {groups.map((g, i) => (
        <div key={i}>
          {g.title && <div className="mb-2 px-3 text-[11px] font-bold tracking-[0.16em] text-white/35 uppercase">{g.title}</div>}
          <ul className="space-y-0.5">
            {g.items.map((it) => (
              <li key={it.to}>
                <NavLink
                  to={it.to}
                  end={it.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn('group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition', isActive ? 'bg-white/10 text-white shadow-[inset_3px_0_0_var(--gold-500)] rtl:shadow-[inset_-3px_0_0_var(--gold-500)]' : 'text-white/65 hover:bg-white/5 hover:text-white')
                  }
                >
                  <it.icon className="size-[18px] shrink-0 opacity-90" />
                  <span className="flex-1">{it.label}</span>
                  {it.badge ? (
                    <span className={cn('num min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold', it.tone === 'danger' ? 'bg-danger text-white' : it.tone === 'teal' ? 'bg-teal text-white' : 'bg-gold text-navy-950')}>{it.badge}</span>
                  ) : null}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function Shell() {
  const me = useMe()
  const isAdmin = me.role === 'admin'
  const can = useCan()
  const reports = can('reports')
  const { signOut, mode } = useAuth()
  const loc = useLocation()
  const nav = useNavigate()
  const quick = useQuickAdd()
  const [mobile, setMobile] = useState(false)
  const [palette, setPalette] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const { data: leads = [], isSuccess: leadsLoaded } = useTable<Lead>('leads', { refetchInterval: 60_000 })
  const { data: tasks = [] } = useTable<Task>('tasks')
  const { data: appts = [] } = useTable<Appointment>('appointments')

  const newLeads = leads.filter((l) => l.status === 'new').length
  const now = new Date()
  const myOverdue = tasks.filter((t) => t.status === 'open' && t.assigned_to === me.id && t.due_at && new Date(t.due_at) < now).length
  const todayAppts = appts.filter((a) => a.status === 'scheduled' && sameDay(a.starts_at, now) && (isAdmin || a.assigned_to === me.id)).length

  // A gentle alert when a new request arrives from the website.
  const prevNew = useRef<number | null>(null)
  useEffect(() => {
    if (!leadsLoaded) return
    if (prevNew.current != null && newLeads > prevNew.current) {
      toast.info('وصل طلب جديد', { description: 'افتح صفحة الطلبات للرد عليه.', action: { label: 'عرض', onClick: () => nav('/admin/leads') } })
    }
    prevNew.current = newLeads
  }, [newLeads, leadsLoaded, nav])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette(true)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
  useEffect(() => setMobile(false), [loc.pathname])

  const allGroups: { title?: string; items: NavItem[] }[] = [
    {
      items: [
        ...(reports ? [{ to: '/admin', label: 'لوحة القيادة', icon: LayoutDashboard, end: true }] : []),
        { to: reports ? '/admin/desk' : '/admin', label: reports ? 'المكتب اليومي' : 'مكتبي', icon: Headset, end: !reports, badge: todayAppts, tone: 'teal' },
        { to: '/admin/leads', label: 'الطلبات', icon: Inbox, badge: newLeads, tone: 'gold' },
        { to: '/admin/agenda', label: 'المواعيد', icon: CalendarDays },
        { to: '/admin/tasks', label: 'المهام', icon: ListTodo, badge: myOverdue, tone: 'danger' },
        { to: '/admin/calls', label: 'سجل المكالمات', icon: PhoneCall },
      ],
    },
    {
      title: 'المحفظة',
      items: [
        { to: '/admin/properties', label: 'العقارات', icon: Building2 },
        { to: '/admin/clients', label: 'العملاء', icon: Users },
        { to: '/admin/brokers', label: 'الوسطاء والشركاء', icon: Handshake },
        { to: '/admin/calculators', label: 'حاسبة المصاريف', icon: Calculator },
      ],
    },
    {
      title: 'الإدارة',
      items: [
        ...(can('deals') ? [{ to: '/admin/deals', label: 'الصفقات والعمولات', icon: HandCoins }] : []),
        ...(isAdmin ? [{ to: '/admin/team', label: 'الفريق', icon: UserCog }] : []),
        ...(can('activity') ? [{ to: '/admin/activity', label: 'سجل النشاط', icon: History }] : []),
        ...(can('settings') ? [{ to: '/admin/settings', label: 'الإعدادات', icon: SettingsIcon }] : []),
      ],
    },
  ]
  const groups = allGroups.filter((g) => g.items.length > 0)

  const quickItems = [
    { label: 'عقار جديد', icon: <Building className="size-4" />, onClick: () => nav('/admin/properties/new'), hidden: !can('properties') },
    { label: 'طلب جديد', icon: <Inbox className="size-4" />, onClick: () => quick('lead') },
    { label: 'موعد / زيارة', icon: <CalendarPlus className="size-4" />, onClick: () => quick('appointment') },
    { label: 'تسجيل مكالمة', icon: <PhoneIncoming className="size-4" />, onClick: () => quick('call') },
    { label: 'عميل جديد', icon: <UserPlus className="size-4" />, onClick: () => quick('client') },
    { label: 'مهمة', icon: <ClipboardPlus className="size-4" />, onClick: () => quick('task') },
    { label: 'شريك في الشبكة', icon: <Handshake className="size-4" />, onClick: () => quick('broker') },
    { label: 'تسجيل صفقة', icon: <BadgeDollarSign className="size-4" />, onClick: () => quick('deal'), hidden: !can('deals') },
  ]

  const sidebar = (
    <div className="flex h-full flex-col bg-navy text-white">
      <div className="flex items-center justify-between px-5 pt-5 pb-6">
        <Link to="/admin">
          <Logo name="سويت هاوس" sub="Immobilier · Admin" light size="sm" />
        </Link>
        <button className="rounded-full p-2 text-white/70 hover:bg-white/10 lg:hidden" onClick={() => setMobile(false)} aria-label="إغلاق">
          <X className="size-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <SideNav groups={groups} onNavigate={() => setMobile(false)} />
      </div>
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={me.name} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{me.name}</div>
            <div className="truncate text-xs text-gold-300">{me.title || ROLE[me.role]}</div>
          </div>
          {mode === 'live' && (
            <button onClick={() => setPwOpen(true)} className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white" title="تغيير كلمة المرور" aria-label="تغيير كلمة المرور">
              <KeyRound className="size-4" />
            </button>
          )}
          <button onClick={() => void signOut()} className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white" title="تسجيل الخروج" aria-label="تسجيل الخروج">
            <LogOut className="size-4" />
          </button>
        </div>
        <Link to="/" className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2 text-xs font-semibold text-white/70 transition hover:border-gold hover:text-gold-300">
          <ExternalLink className="size-3.5" /> عرض الموقع
        </Link>
      </div>
    </div>
  )

  return (
    <div className="admin-root flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 lg:block">{sidebar}</aside>
      {mobile && (
        <div className="fixed inset-0 z-[90] lg:hidden">
          <div className="anim-fade absolute inset-0 bg-navy-950/60" onClick={() => setMobile(false)} />
          <div className="anim-up absolute inset-y-0 start-0 w-[280px] shadow-pop">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-[#f4f3ef]/90 px-4 py-3 backdrop-blur md:px-8">
          <button className="rounded-full p-2 text-navy hover:bg-navy/5 lg:hidden" onClick={() => setMobile(true)} aria-label="القائمة">
            <Menu className="size-5" />
          </button>
          <button onClick={() => setPalette(true)} className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3 text-sm text-subtle transition hover:border-line-2 md:max-w-md">
            <Search className="size-4 shrink-0" />
            <span className="truncate">ابحث عن عقار، عميل، رقم هاتف…</span>
            <kbd className="ms-auto hidden rounded-md border border-line bg-ivory px-1.5 py-0.5 text-[10px] font-semibold text-muted md:inline" dir="ltr">
              Ctrl K
            </kbd>
          </button>
          <div className="ms-auto flex items-center gap-2">
            {mode === 'demo' && (
              <Badge tone="warning" className="hidden sm:inline-flex">
                وضع تجريبي
              </Badge>
            )}
            <DropMenu
              items={quickItems}
              label="إضافة"
              trigger={
                <span className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-navy px-4 text-sm font-bold text-white shadow-soft transition hover:bg-navy-800">
                  <Plus className="size-4" /> <span className="hidden sm:inline">جديد</span>
                </span>
              }
            />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] min-w-0 flex-1 p-4 md:p-8">
          <Suspense fallback={<FullSpinner />}>
          <Routes>
            <Route index element={reports ? <Dashboard /> : <Desk />} />
            <Route path="desk" element={<Desk />} />
            <Route path="properties" element={<Properties />} />
            <Route path="properties/new" element={<Allowed perm="properties"><PropertyEditor /></Allowed>} />
            <Route path="properties/:id" element={<PropertyEditor />} />
            <Route path="leads" element={<Leads />} />
            <Route path="clients" element={<Clients />} />
            <Route path="brokers" element={<Brokers />} />
            <Route path="calculators" element={<Calculators />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="calls" element={<Calls />} />
            <Route path="deals" element={<Allowed perm="deals"><Deals /></Allowed>} />
            <Route path="team" element={<Allowed><Team /></Allowed>} />
            <Route path="activity" element={<Allowed perm="activity"><Activity /></Allowed>} />
            <Route path="settings" element={<Allowed perm="settings"><Settings /></Allowed>} />
            <Route path="*" element={<AdminNotFound />} />
          </Routes>
          </Suspense>
        </main>
      </div>
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
      <ChangePasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  )
}

/** A page for admins (no perm) or for members holding `perm`. */
function Allowed({ perm, children }: { perm?: Permission; children: ReactNode }) {
  const me = useMe()
  const can = useCan()
  if (perm ? can(perm) : me.role === 'admin') return <>{children}</>
  return (
    <div className="card mx-auto mt-10 max-w-lg p-10 text-center">
      <ShieldAlert className="mx-auto size-10 text-warning" />
      <h1 className="mt-4 text-xl font-bold text-navy">{perm ? 'ليست لديك صلاحية لهذه الصفحة' : 'هذه الصفحة خاصة بالمدير'}</h1>
      {perm && <p className="mt-2 text-sm text-muted">يستطيع المدير منحك هذه الصلاحية من صفحة «الفريق».</p>}
      <Link to="/admin" className="mt-4 inline-block font-semibold text-teal">
        العودة إلى مكتبي
      </Link>
    </div>
  )
}

function AdminNotFound() {
  return (
    <div className="card mx-auto mt-10 max-w-lg p-10 text-center">
      <h1 className="text-xl font-bold text-navy">الصفحة غير موجودة</h1>
      <Link to="/admin" className="mt-4 inline-block font-semibold text-teal">
        العودة
      </Link>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Ctrl+K: search everything                                            */
/* ------------------------------------------------------------------ */
function CommandPalette({ onClose }: { onClose: () => void }) {
  const nav = useNavigate()
  const { hoodName } = useNames()
  const { data: props = [] } = useTable<Property>('properties')
  const { data: clients = [] } = useTable<Client>('clients')
  const { data: leads = [] } = useTable<Lead>('leads')
  const { data: brokers = [] } = useTable<Broker>('brokers')
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    const digits = phoneKey(s)
    const out: { key: string; group: string; label: string; sub: string; go: () => void }[] = []
    for (const p of props) {
      if (`${p.ref} ${p.title} ${p.title_fr ?? ''} ${hoodName(p.neighborhood)} ${p.city}`.toLowerCase().includes(s))
        out.push({ key: 'p' + p.id, group: 'العقارات', label: `${p.ref} — ${p.title}`, sub: hoodName(p.neighborhood), go: () => nav(`/admin/properties/${p.id}`) })
      if (out.length >= 6) break
    }
    let n = 0
    for (const c of clients) {
      if (`${c.full_name} ${c.email ?? ''}`.toLowerCase().includes(s) || (digits.length >= 4 && phoneKey(c.phone).includes(digits))) {
        out.push({ key: 'c' + c.id, group: 'العملاء', label: c.full_name, sub: `${CLIENT_KIND[c.kind].label} · ${c.phone}`, go: () => nav(`/admin/clients?open=${c.id}`) })
        if (++n >= 5) break
      }
    }
    n = 0
    for (const l of leads) {
      if (`${l.name} ${l.property_ref ?? ''} ${l.message ?? ''}`.toLowerCase().includes(s) || (digits.length >= 4 && phoneKey(l.phone).includes(digits))) {
        out.push({ key: 'l' + l.id, group: 'الطلبات', label: l.name, sub: `${LEAD_STATUS[l.status].label}${l.property_ref ? ` · ${l.property_ref}` : ''}`, go: () => nav(`/admin/leads?open=${l.id}`) })
        if (++n >= 5) break
      }
    }
    n = 0
    for (const b of brokers) {
      if (`${b.full_name} ${b.company ?? ''}`.toLowerCase().includes(s) || (digits.length >= 4 && phoneKey(b.phone).includes(digits))) {
        out.push({ key: 'b' + b.id, group: 'الشركاء', label: b.full_name, sub: `${BROKER_KIND[b.kind].label}${b.company ? ` · ${b.company}` : ''}`, go: () => nav(`/admin/brokers?open=${b.id}`) })
        if (++n >= 4) break
      }
    }
    return out
  }, [q, props, clients, leads, brokers, hoodName, nav])

  useEffect(() => setActive(0), [q])
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const go = (i: number) => {
    const r = results[i]
    if (!r) return
    r.go()
    onClose()
  }

  let lastGroup = ''
  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true">
      <div className="anim-fade absolute inset-0 bg-navy-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="anim-pop relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-pop">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-5 text-subtle" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, results.length - 1)))
              if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)))
              if (e.key === 'Enter') go(active)
            }}
            placeholder="مرجع عقار (SH-1001)، اسم عميل، رقم هاتف…"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-subtle"
          />
          <button onClick={onClose} className="rounded-full p-1.5 text-subtle hover:bg-sand" aria-label="إغلاق">
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {!q && <p className="px-3 py-6 text-center text-sm text-muted">اكتب للبحث في العقارات والعملاء والطلبات.</p>}
          {q && results.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">لا توجد نتائج لـ «{q}»</p>}
          {results.map((r, i) => {
            const head = r.group !== lastGroup ? r.group : null
            lastGroup = r.group
            return (
              <div key={r.key}>
                {head && <div className="px-3 pt-3 pb-1 text-[11px] font-bold tracking-wide text-subtle">{head}</div>}
                <button onMouseEnter={() => setActive(i)} onClick={() => go(i)} className={cn('flex w-full flex-col items-start rounded-xl px-3 py-2.5 text-start', i === active ? 'bg-sand' : 'hover:bg-sand/60')}>
                  <span className="text-sm font-semibold text-navy">{r.label}</span>
                  <span className="text-xs text-muted">{r.sub}</span>
                </button>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-3 border-t border-line bg-ivory px-4 py-2 text-[11px] text-subtle">
          <Pill color="#5b6475">↑↓ للتنقل</Pill>
          <Pill color="#5b6475">Enter للفتح</Pill>
          <Pill color="#5b6475">Esc للإغلاق</Pill>
        </div>
      </div>
    </div>
  )
}
