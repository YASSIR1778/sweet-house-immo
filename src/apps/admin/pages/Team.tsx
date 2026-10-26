import { Info, ShieldCheck, UserCog } from 'lucide-react'
import { useMemo } from 'react'
import { useAuth } from '@/shared/lib/auth'
import { useTable } from '@/shared/lib/data'
import { addDays, fmtDate } from '@/shared/lib/format'
import type { Appointment, CallLog, Lead, Property, Role, Staff, Task } from '@/shared/lib/types'
import { Button, Select, Switch } from '@/shared/ui/base'
import { useMe, useSave } from '../hooks'
import { ROLE } from '../labels'
import { Avatar, PageHeader, Pill } from '../ui'

export function Team() {
  const me = useMe()
  const { mode } = useAuth()
  const { data: staff = [] } = useTable<Staff>('staff')
  const { data: calls = [] } = useTable<CallLog>('calls')
  const { data: appts = [] } = useTable<Appointment>('appointments')
  const { data: leads = [] } = useTable<Lead>('leads')
  const { data: tasks = [] } = useTable<Task>('tasks')
  const { data: props = [] } = useTable<Property>('properties')
  const { save } = useSave<Staff>('staff', 'staff', (s) => s.full_name)

  const since = addDays(new Date(), -30)
  const stats = useMemo(
    () =>
      new Map(
        staff.map((s) => [
          s.id,
          {
            calls: calls.filter((c) => c.logged_by === s.id && new Date(c.created_at) >= since).length,
            visits: appts.filter((a) => a.assigned_to === s.id && a.status === 'done' && new Date(a.starts_at) >= since).length,
            leads: leads.filter((l) => l.assigned_to === s.id).length,
            tasks: tasks.filter((t) => t.assigned_to === s.id && t.status === 'done' && t.completed_at && new Date(t.completed_at) >= since).length,
            props: props.filter((p) => p.created_by === s.id).length,
          },
        ]),
      ),
    [staff, calls, appts, leads, tasks, props], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const admins = staff.filter((s) => s.role === 'admin' && s.active).length
  const pending = staff.filter((s) => !s.active)
  const active = staff.filter((s) => s.active)

  const card = (s: Staff) => {
    const st = stats.get(s.id)
    const self = s.id === me.id
    return (
      <div key={s.id} className="card p-5">
        <div className="flex items-start gap-4">
          <Avatar name={s.full_name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-navy">{s.full_name}</h3>
              {self && <Pill color="#a8832f">أنت</Pill>}
              {!s.active && <Pill color="#b45309">في انتظار التفعيل</Pill>}
            </div>
            <div className="truncate text-sm text-muted" dir="ltr">
              {s.email}
            </div>
            <div className="mt-0.5 text-xs text-subtle">عضو منذ {fmtDate(s.created_at)}</div>
          </div>
        </div>
        {st && s.active && (
          <div className="mt-4 grid grid-cols-5 gap-2 rounded-xl bg-ivory p-3 text-center">
            {[
              ['مكالمات', st.calls],
              ['زيارات', st.visits],
              ['طلبات', st.leads],
              ['مهام', st.tasks],
              ['عقارات', st.props],
            ].map(([l, v]) => (
              <div key={l}>
                <div className="num text-lg font-extrabold text-navy">{v}</div>
                <div className="text-[11px] text-muted">{l}</div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">الدور:</span>
            <Select
              value={s.role}
              disabled={self && admins <= 1}
              onChange={(e) => void save({ ...s, role: e.target.value as Role }, { message: `أصبح ${s.full_name}: ${ROLE[e.target.value as Role]}` })}
              className="h-9 w-auto py-1 text-sm"
            >
              <option value="secretary">{ROLE.secretary}</option>
              <option value="admin">{ROLE.admin}</option>
            </Select>
          </label>
          {!self && <Switch checked={s.active} onChange={(v) => void save({ ...s, active: v }, { message: v ? 'تم تفعيل الحساب' : 'تم إيقاف الحساب' })} label={s.active ? 'الحساب مفعل' : 'الحساب موقوف'} />}
          {!s.active && (
            <Button size="sm" variant="gold" icon={<ShieldCheck className="size-4" />} onClick={() => void save({ ...s, active: true }, { message: `تم تفعيل حساب ${s.full_name}` })}>
              تفعيل الآن
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader title="الفريق" subtitle="الحسابات، الأدوار والصلاحيات — مع أرقام آخر 30 يوماً" icon={<UserCog className="size-6" />} />
      <div className="mb-6 flex gap-3 rounded-2xl border border-info/20 bg-info/5 p-4 text-sm text-navy">
        <Info className="mt-0.5 size-5 shrink-0 text-info" />
        <div className="space-y-1">
          <p>
            <b>المدير</b> يرى كل شيء: الأرقام، العمولات، سجل النشاط والإعدادات. <b>الكاتبة</b> ترى المكتب اليومي، الطلبات، المواعيد، العملاء، المهام، المكالمات والعقارات، ولا ترى العمولات ولا تستطيع الحذف.
          </p>
          {mode === 'live' ? (
            <p>لإضافة عضو: يفتح صفحة «دخول الفريق» ويضغط «عضو جديد؟ أنشئ حساباً»، ثم تفعّل حسابه هنا.</p>
          ) : (
            <p>في النسخة التجريبية يوجد حسابان ثابتان. بعد ربط قاعدة البيانات، يُنشئ كل عضو حسابه وتفعّله أنت من هنا.</p>
          )}
        </div>
      </div>
      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-bold text-warning">حسابات تنتظر التفعيل ({pending.length})</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{pending.map(card)}</div>
        </section>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{active.map(card)}</div>
    </>
  )
}
