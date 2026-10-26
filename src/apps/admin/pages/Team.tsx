import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Info, KeyRound, Pencil, ShieldCheck, Sparkles, Trash2, TriangleAlert, UserCog, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/shared/lib/auth'
import { useTable } from '@/shared/lib/data'
import { addDays, fmtDate, uid } from '@/shared/lib/format'
import { logActivity, repo } from '@/shared/lib/repo'
import type { Appointment, CallLog, Lead, Permission, Property, Role, Staff, Task } from '@/shared/lib/types'
import { Button, Field, Input, Modal, Segmented, Switch, cn, useConfirm } from '@/shared/ui/base'
import { ChangePasswordDialog } from '../change-password'
import { errorText, useMe, useSave } from '../hooks'
import { ROLE } from '../labels'
import { DAILY_WORK, DEFAULT_PERMISSIONS, JOB_TITLES, PERMISSIONS, PERMISSION_LABEL } from '../permissions'
import { credentialsText, generatePassword, LOGIN_URL, staffService, StaffServiceError, type CreatedStaff } from '../staff-service'
import { Avatar, PageHeader, Pill } from '../ui'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const failText = (e: unknown) => (e instanceof StaffServiceError ? e.message : errorText(e))

export function Team() {
  const me = useMe()
  const { mode } = useAuth()
  const live = mode === 'live'
  const { data: staff = [] } = useTable<Staff>('staff')
  const { data: calls = [] } = useTable<CallLog>('calls')
  const { data: appts = [] } = useTable<Appointment>('appointments')
  const { data: leads = [] } = useTable<Lead>('leads')
  const { data: tasks = [] } = useTable<Task>('tasks')
  const { data: props = [] } = useTable<Property>('properties')
  const { save } = useSave<Staff>('staff', 'staff', (s) => s.full_name)
  const service = useQuery({ queryKey: ['staff-service'], queryFn: () => staffService({ action: 'check' }), enabled: live, retry: false, staleTime: 5 * 60_000 })
  const serviceCode = service.error ? (service.error instanceof StaffServiceError ? service.error.code : 'service_error') : null
  const [editing, setEditing] = useState<Staff | 'new' | null>(null)
  const [pwFor, setPwFor] = useState<Staff | null>(null)
  const [selfPw, setSelfPw] = useState(false)

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
  const inactive = staff.filter((s) => !s.active)
  const active = staff.filter((s) => s.active)

  const card = (s: Staff) => {
    const st = stats.get(s.id)
    const self = s.id === me.id
    const perms = s.permissions ?? DEFAULT_PERMISSIONS
    return (
      <div key={s.id} className="card flex flex-col p-5">
        <div className="flex items-start gap-4">
          <Avatar name={s.full_name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-navy">{s.full_name}</h3>
              {self && <Pill color="#a8832f">أنت</Pill>}
              {!s.active && <Pill color="#b45309">موقوف</Pill>}
            </div>
            <div className="text-sm font-semibold text-gold-700">
              {s.title || ROLE[s.role]}
              {s.title && s.role === 'admin' ? ' · مدير' : ''}
            </div>
            <div className="truncate text-sm text-muted">
              <span dir="ltr">{s.email}</span>
            </div>
            {s.phone && (
              <div className="num text-sm text-muted">
                <span dir="ltr">{s.phone}</span>
              </div>
            )}
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
        <div className="mt-4">
          <div className="mb-1.5 text-xs font-bold text-muted">الصلاحيات</div>
          <div className="flex flex-wrap gap-1.5">
            {s.role === 'admin' ? (
              <Pill color="#a8832f">كل الصلاحيات وإدارة الفريق</Pill>
            ) : perms.length ? (
              perms.map((p) => (
                <Pill key={p} color="#0f766e">
                  {PERMISSION_LABEL[p] ?? p}
                </Pill>
              ))
            ) : (
              <span className="text-xs text-subtle">العمل اليومي فقط</span>
            )}
          </div>
        </div>
        <div className="flex-1" />
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Button size="sm" variant="outline" icon={<Pencil className="size-4" />} onClick={() => setEditing(s)}>
            تعديل
          </Button>
          {live && (
            <Button size="sm" variant="outline" icon={<KeyRound className="size-4" />} onClick={() => (self ? setSelfPw(true) : setPwFor(s))}>
              كلمة المرور
            </Button>
          )}
          {!s.active && (
            <Button size="sm" variant="gold" icon={<ShieldCheck className="size-4" />} onClick={() => void save({ ...s, active: true }, { message: `تم تفعيل حساب ${s.full_name}` })}>
              تفعيل الآن
            </Button>
          )}
          {!self && s.active && (
            <span className="ms-auto">
              <Switch checked={s.active} onChange={(v) => void save({ ...s, active: v }, { message: v ? 'تم تفعيل الحساب' : 'تم إيقاف الحساب' })} label="مفعّل" />
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="الفريق"
        subtitle="الموظفون، كلمات المرور والصلاحيات، مع أرقام آخر 30 يوماً"
        icon={<UserCog className="size-6" />}
        actions={
          <Button variant="gold" icon={<UserPlus className="size-4" />} onClick={() => setEditing('new')}>
            إضافة موظف
          </Button>
        }
      />
      {live && serviceCode && (
        <div className="mb-4 flex gap-3 rounded-2xl border border-warning/30 bg-warning/5 p-4 text-sm text-navy">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" />
          <div>
            <p className="font-bold">{new StaffServiceError(serviceCode).message}</p>
            <p className="mt-1 text-muted">تعديل الصلاحيات وتفعيل الحسابات يعملان من هنا. أما إنشاء حساب جديد أو تغيير كلمة مرور موظف فيحتاج هذه الخدمة.</p>
          </div>
        </div>
      )}
      <div className="mb-6 flex gap-3 rounded-2xl border border-info/20 bg-info/5 p-4 text-sm text-navy">
        <Info className="mt-0.5 size-5 shrink-0 text-info" />
        <div className="space-y-1">
          <p>
            <b>المدير</b> يملك كل الصلاحيات ويدير الفريق. <b>الموظف</b> يشتغل دائماً على {DAILY_WORK}، وتختار أنت ما يُسمح له به زيادة على ذلك.
          </p>
          {live ? (
            <p>عند إضافة موظف تكتب بريده وكلمة مروره، ثم تعطيه إياهما ليدخل من صفحة الدخول. يستطيع بعدها تغيير كلمة مروره بنفسه من زر المفتاح أسفل القائمة.</p>
          ) : (
            <p>في النسخة التجريبية يُضاف الموظف للعرض فقط، ولا يُنشأ له حساب دخول.</p>
          )}
        </div>
      </div>
      {inactive.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-bold text-warning">حسابات موقوفة أو تنتظر التفعيل ({inactive.length})</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{inactive.map(card)}</div>
        </section>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{active.map(card)}</div>

      {editing && <StaffDialog member={editing === 'new' ? null : editing} live={live} admins={admins} onClose={() => setEditing(null)} />}
      {pwFor && <MemberPasswordDialog member={pwFor} onClose={() => setPwFor(null)} />}
      <ChangePasswordDialog open={selfPw} onClose={() => setSelfPw(false)} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Add / edit a member                                                  */
/* ------------------------------------------------------------------ */
function StaffDialog({ member, live, admins, onClose }: { member: Staff | null; live: boolean; admins: number; onClose: () => void }) {
  const me = useMe()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const { save } = useSave<Staff>('staff', 'staff', (s) => s.full_name)
  const isNew = !member
  const self = member?.id === me.id
  const [f, setF] = useState({
    full_name: member?.full_name ?? '',
    title: member?.title ?? '',
    email: member?.email ?? '',
    phone: member?.phone ?? '',
    password: '',
    role: (member?.role ?? 'secretary') as Role,
    permissions: (member?.permissions ?? DEFAULT_PERMISSIONS) as Permission[],
    active: member?.active ?? true,
  })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ name: string; email: string; password: string; linked: boolean } | null>(null)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  const toggle = (p: Permission) => set('permissions', f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p])

  const submit = async () => {
    const name = f.full_name.trim().replace(/\s+/g, ' ')
    const email = f.email.trim().toLowerCase()
    const phone = f.phone.trim() || null
    const title = f.title.trim() || null
    const permissions = PERMISSIONS.map((p) => p.key).filter((k) => f.permissions.includes(k))
    if (!name) return toast.error('اكتب اسم الموظف.')
    if (!EMAIL_RE.test(email)) return toast.error('اكتب بريداً إلكترونياً صحيحاً.')
    if (member && member.role === 'admin' && member.active && (f.role !== 'admin' || !f.active) && admins <= 1) return toast.error('يجب أن يبقى مدير واحد مفعّل على الأقل.')
    if (isNew && live && f.password.length < 8) return toast.error('كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.')
    setBusy(true)
    try {
      if (!member) {
        if (live) {
          const r = await staffService<CreatedStaff>({ action: 'create', full_name: name, email, password: f.password, phone, title, role: f.role, permissions })
          await qc.invalidateQueries({ queryKey: ['staff'] })
          void logActivity(me, 'create', 'staff', r.staff?.id ?? null, { title: name })
          setDone({ name, email, password: f.password, linked: r.linked })
        } else {
          const row: Staff = { id: uid(), full_name: name, email, phone, title, role: f.role, permissions, active: true, created_at: new Date().toISOString() }
          if (await save(row, { isNew: true, message: `تمت إضافة ${name} (للعرض فقط في النسخة التجريبية)` })) onClose()
        }
        return
      }
      let nextEmail = member.email
      if (email !== member.email.trim().toLowerCase()) {
        if (live) await staffService({ action: 'set_email', user_id: member.id, email })
        nextEmail = email
      }
      const row: Staff = {
        ...member,
        full_name: name,
        email: nextEmail,
        phone,
        title,
        role: self ? member.role : f.role,
        permissions,
        active: self ? member.active : f.active,
      }
      if (await save(row, { message: `تم حفظ بيانات ${name}` })) onClose()
    } catch (e) {
      toast.error(failText(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!member) return
    const yes = await confirm({
      title: `حذف حساب ${member.full_name} نهائياً؟`,
      text: 'لن يستطيع الدخول بعد الآن، وتبقى أعماله في السجلات بدون اسمه. إن أردت منعه مؤقتاً فقط، أوقف الحساب بدل حذفه.',
      confirmLabel: 'حذف نهائي',
      danger: true,
    })
    if (!yes) return
    setBusy(true)
    try {
      if (live) await staffService({ action: 'delete', user_id: member.id })
      else await repo.remove('staff', member.id)
      await qc.invalidateQueries({ queryKey: ['staff'] })
      void logActivity(me, 'delete', 'staff', member.id, { title: member.full_name })
      toast.success(`تم حذف حساب ${member.full_name}`)
      onClose()
    } catch (e) {
      toast.error(failText(e))
    } finally {
      setBusy(false)
    }
  }

  if (done) return <CredentialsDialog title="تم إنشاء الحساب" intro={done.linked ? `كان لهذا البريد حساب سابق، فأضفناه إلى الفريق بكلمة المرور الجديدة. أعطِ ${done.name} هذه البيانات ليدخل:` : `حساب ${done.name} جاهز ومفعّل. أعطه هذه البيانات ليدخل:`} {...done} onClose={onClose} />

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={
        <span className="inline-flex items-center gap-2">
          {isNew ? <UserPlus className="size-5 text-gold-600" /> : <Pencil className="size-5 text-gold-600" />}
          {isNew ? 'إضافة موظف' : `تعديل: ${member.full_name}`}
        </span>
      }
      footer={
        <>
          {member && !self && (
            <Button variant="ghost" className="me-auto text-danger" icon={<Trash2 className="size-4" />} onClick={() => void remove()} disabled={busy}>
              حذف الحساب
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button variant="gold" loading={busy} onClick={() => void submit()} icon={isNew ? <UserPlus className="size-4" /> : <Check className="size-4" />}>
            {isNew ? 'إضافة الموظف' : 'حفظ'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        autoComplete="off"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="الاسم الكامل" required>
            <Input value={f.full_name} onChange={(e) => set('full_name', e.target.value)} autoFocus={isNew} />
          </Field>
          <Field label="الوظيفة" hint="تظهر تحت اسمه في الفريق">
            <Input list="shi-job-titles" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="مثلاً: كاتبة" />
            <datalist id="shi-job-titles">
              {JOB_TITLES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label="البريد الإلكتروني" required hint={isNew ? 'يدخل به إلى لوحة الفريق' : self ? 'بريد حسابك لا يتغير من هنا' : live ? 'إن غيّرته، يدخل بالبريد الجديد' : undefined}>
            <Input type="email" dir="ltr" value={f.email} onChange={(e) => set('email', e.target.value)} disabled={self} autoComplete="off" />
          </Field>
          <Field label="الهاتف">
            <Input type="tel" dir="ltr" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="06…" />
          </Field>
          {isNew && live && (
            <Field label="كلمة المرور" required hint="8 أحرف على الأقل. أعطها للموظف، ويستطيع تغييرها بعد الدخول." className="sm:col-span-2">
              <div className="flex gap-2">
                <Input dir="ltr" value={f.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" spellCheck={false} className="font-mono" />
                <Button type="button" variant="outline" icon={<Sparkles className="size-4" />} onClick={() => set('password', generatePassword())}>
                  اقترح كلمة
                </Button>
              </div>
            </Field>
          )}
        </div>

        {!self && (
          <div className="mt-6">
            <div className="mb-2 text-sm font-bold text-navy">نوع الحساب</div>
            <Segmented
              value={f.role}
              onChange={(v) => set('role', v)}
              options={[
                { value: 'secretary', label: 'موظف' },
                { value: 'admin', label: 'مدير' },
              ]}
            />
            <p className="mt-2 text-xs text-muted">
              {f.role === 'admin' ? 'المدير يملك كل الصلاحيات، ويضيف الموظفين ويغيّر كلمات مرورهم.' : `الموظف يشتغل دائماً على ${DAILY_WORK}. اختر ما يُسمح له به زيادة على ذلك:`}
            </p>
          </div>
        )}
        {!self && f.role !== 'admin' && (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PERMISSIONS.map((p) => {
              const on = f.permissions.includes(p.key)
              return (
                <label key={p.key} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition', on ? 'border-teal bg-teal/5' : 'border-line hover:border-line-2')}>
                  <input type="checkbox" checked={on} onChange={() => toggle(p.key)} className="mt-0.5 size-4 shrink-0 accent-[#0f766e]" />
                  <span>
                    <span className="block text-sm font-bold text-navy">{p.label}</span>
                    <span className="block text-xs text-muted">{p.hint}</span>
                  </span>
                </label>
              )
            })}
          </div>
        )}
        {member && !self && (
          <div className="mt-5">
            <Switch checked={f.active} onChange={(v) => set('active', v)} label={f.active ? 'الحساب مفعّل' : 'الحساب موقوف: لا يستطيع العمل في اللوحة'} />
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* New password for a member                                            */
/* ------------------------------------------------------------------ */
function MemberPasswordDialog({ member, onClose }: { member: Staff; onClose: () => void }) {
  const me = useMe()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async () => {
    if (pw.length < 8) return toast.error('كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.')
    setBusy(true)
    try {
      await staffService({ action: 'set_password', user_id: member.id, password: pw })
      void logActivity(me, 'update', 'staff', member.id, { title: member.full_name, password: true })
      setDone(true)
    } catch (e) {
      toast.error(failText(e))
    } finally {
      setBusy(false)
    }
  }

  if (done) return <CredentialsDialog title="تم تغيير كلمة المرور" intro={`أعطِ ${member.full_name} كلمة المرور الجديدة:`} name={member.full_name} email={member.email} password={pw} onClose={onClose} />

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={
        <span className="inline-flex items-center gap-2">
          <KeyRound className="size-5 text-gold-600" /> كلمة مرور جديدة
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button variant="gold" loading={busy} onClick={() => void submit()}>
            حفظ
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="space-y-4"
        autoComplete="off"
      >
        <p className="text-sm text-muted">
          كلمة مرور جديدة لـ <b className="text-navy">{member.full_name}</b>. القديمة لن تعمل بعد الحفظ.
        </p>
        <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل">
          <div className="flex gap-2">
            <Input dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" spellCheck={false} className="font-mono" autoFocus />
            <Button type="button" variant="outline" icon={<Sparkles className="size-4" />} onClick={() => setPw(generatePassword())}>
              اقترح كلمة
            </Button>
          </div>
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Log-in details to hand over (shown once)                             */
/* ------------------------------------------------------------------ */
function CredentialsDialog({ title, intro, name, email, password, onClose }: { title: string; intro: string; name: string; email: string; password: string; onClose: () => void }) {
  const copy = () =>
    navigator.clipboard.writeText(credentialsText(name, email, password)).then(
      () => toast.success('تم نسخ بيانات الدخول'),
      () => toast.error('تعذر النسخ. اكتبها يدوياً.'),
    )
  const rows: [string, string][] = [
    ['رابط الدخول', LOGIN_URL()],
    ['البريد', email],
    ['كلمة المرور', password],
  ]
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={
        <span className="inline-flex items-center gap-2">
          <Check className="size-5 text-success" /> {title}
        </span>
      }
      footer={
        <>
          <Button variant="outline" icon={<Copy className="size-4" />} onClick={() => void copy()}>
            نسخ بيانات الدخول
          </Button>
          <Button onClick={onClose}>تم</Button>
        </>
      }
    >
      <p className="text-sm text-muted">{intro}</p>
      <dl className="mt-4 space-y-3 rounded-2xl bg-ivory p-4">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-semibold text-muted">{k}</dt>
            <dd className="text-end font-mono text-sm font-bold break-all text-navy" dir="ltr">
              {v}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-subtle">لن تظهر كلمة المرور مرة أخرى بعد إغلاق هذه النافذة.</p>
    </Modal>
  )
}
