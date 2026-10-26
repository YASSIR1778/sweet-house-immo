import { BookOpen, Handshake, Landmark, RotateCcw, Save } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useNetwork, useSaveNetwork, useSaveSettings, useSettings } from '@/shared/lib/data'
import { DEFAULT_COMMISSION, DEFAULT_FEES, DEFAULT_NETWORK } from '@/shared/lib/fee-defaults'
import { fmtDate } from '@/shared/lib/format'
import { logActivity } from '@/shared/lib/repo'
import type { CommissionSettings, FeeSettings, NetworkSettings, Settings } from '@/shared/lib/types'
import { Button, Field, Input, Switch, useConfirm } from '@/shared/ui/base'
import { errorText, useMe } from '../hooks'
import { Card } from '../ui'

const n = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? 0 : Number(v))

function Num({ label, value, onChange, unit, hint, step = 'any' }: { label: ReactNode; value: number; onChange: (v: number) => void; unit: string; hint?: ReactNode; step?: string }) {
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <Input type="number" step={step} min={0} dir="ltr" className="num pe-16" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(n(e.target.value))} />
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-muted">{unit}</span>
      </div>
    </Field>
  )
}

function Source({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">
        {children}
      </a>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* Agency fees + sharing with partners                                  */
/* ------------------------------------------------------------------ */
export function CommissionTab() {
  const { data } = useSettings()
  const s = data as Settings
  const { data: network = DEFAULT_NETWORK } = useNetwork()
  return <CommissionForms key={JSON.stringify([s.commission, network])} commission={s.commission} network={network} />
}

function CommissionForms({ commission, network }: { commission: CommissionSettings; network: NetworkSettings }) {
  const me = useMe()
  const saveSettings = useSaveSettings()
  const saveNetwork = useSaveNetwork()
  const [c, setC] = useState(commission)
  const [w, setW] = useState(network)
  const setc = <K extends keyof CommissionSettings>(k: K, v: number) => setC((x) => ({ ...x, [k]: v }))
  const setw = <K extends keyof NetworkSettings>(k: K, v: number) => setW((x) => ({ ...x, [k]: v }))

  const saveC = async () => {
    try {
      await saveSettings.mutateAsync({ key: 'commission', value: c })
      void logActivity(me, 'update', 'settings', 'commission', { title: 'أتعاب الوكالة' })
      toast.success('تم حفظ أتعاب الوكالة. الحاسبات في الموقع تستعمل النسب الجديدة.')
    } catch (e) {
      toast.error(errorText(e))
    }
  }
  const saveW = async () => {
    if (w.listing_share + w.client_share > 100) return toast.error('مجموع حصتي جانب العقار وجانب الزبون لا يتجاوز 100%')
    try {
      await saveNetwork.mutateAsync(w)
      void logActivity(me, 'update', 'settings', 'network', { title: 'تقسيم العمولة مع الشركاء' })
      toast.success('تم حفظ قواعد تقسيم العمولة')
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div className="space-y-6">
        <Card title="أتعاب الوكالة" icon={<Landmark className="size-4" />}>
          <p className="mb-4 text-sm text-muted">تظهر للزبائن في حاسبات الموقع، وتُقترح تلقائياً عند تسجيل كل صفقة. تبقى قابلة للتعديل في كل صفقة.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Num label="البيع: من المشتري" value={c.sale_buyer} onChange={(v) => setc('sale_buyer', v)} unit="% من الثمن" step="0.1" />
            <Num label="البيع: من البائع" value={c.sale_seller} onChange={(v) => setc('sale_seller', v)} unit="% من الثمن" step="0.1" />
            <Num label="الكراء: من المكتري" value={c.rent_tenant} onChange={(v) => setc('rent_tenant', v)} unit="شهر" step="0.5" />
            <Num label="الكراء: من المالك" value={c.rent_owner} onChange={(v) => setc('rent_owner', v)} unit="شهر" step="0.5" />
            <Num label="الضريبة على القيمة المضافة" value={c.vat} onChange={(v) => setc('vat', v)} unit="%" hint="0 إن كانت النسب أعلاه نهائية. 20 إن كانت الوكالة تضيف الضريبة." />
            <Num label="حد أدنى لكل طرف" value={c.min_amount} onChange={(v) => setc('min_amount', v)} unit="درهم" hint="0 = بدون حد أدنى" />
          </div>
          <div className="mt-5 flex flex-wrap justify-between gap-2">
            <Button variant="ghost" icon={<RotateCcw className="size-4" />} onClick={() => setC(DEFAULT_COMMISSION)}>
              العرف المعمول به
            </Button>
            <Button variant="gold" loading={saveSettings.isPending} icon={<Save className="size-4" />} onClick={() => void saveC()}>
              حفظ الأتعاب
            </Button>
          </div>
        </Card>

        <Card title="تقسيم العمولة مع الشركاء" icon={<Handshake className="size-4" />}>
          <p className="mb-4 text-sm text-muted">قواعد داخلية لا تظهر في الموقع. تُقترح بها حصص الوسطاء في كل صفقة، ولكل وسيط اتفاقه الخاص إن سجلته في بطاقته.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Num label="جانب العقار: من جلب العقار" value={w.listing_share} onChange={(v) => setw('listing_share', v)} unit="% من العمولة" />
            <Num label="جانب الزبون: من جلب الزبون" value={w.client_share} onChange={(v) => setw('client_share', v)} unit="% من العمولة" />
            <Num label="المُرشد الذي يعطي المعلومة فقط" value={w.referrer_share} onChange={(v) => setw('referrer_share', v)} unit="% من العمولة" />
            <Num label="مكافأة الموظف الذي أنجز الصفقة" value={w.staff_bonus} onChange={(v) => setw('staff_bonus', v)} unit="% من العمولة" hint="0 = بدون مكافأة تلقائية" />
          </div>
          <p className="mt-3 rounded-xl bg-ivory p-3 text-xs leading-relaxed text-muted">
            إن جلب وسيط الزبون والعقار عندك، يأخذ حصة جانب الزبون وتبقى للوكالة حصة جانب العقار. إن اشترك أكثر من وسيط في الجانب نفسه، تُقسم حصة الجانب بينهم بالتساوي. كل هذا يُعدَّل في الصفقة نفسها.
          </p>
          <div className="mt-5 flex flex-wrap justify-between gap-2">
            <Button variant="ghost" icon={<RotateCcw className="size-4" />} onClick={() => setW(DEFAULT_NETWORK)}>
              العرف المعمول به
            </Button>
            <Button variant="gold" loading={saveNetwork.isPending} icon={<Save className="size-4" />} onClick={() => void saveW()}>
              حفظ قواعد التقسيم
            </Button>
          </div>
        </Card>
      </div>

      <Card title="ما يقوله القانون والعرف في المغرب" icon={<BookOpen className="size-4" />}>
        <ul className="list-disc space-y-2.5 ps-5 text-sm leading-relaxed text-navy">
          <li>لا يحدد القانون المغربي نسبة العمولة. مدونة التجارة، في المواد من 405 إلى 422 عن السمسرة، تجعل الأجرة على من كلّف الوسيط ما لم يوجد اتفاق أو عرف. وعند الخلاف تحددها المحكمة.</li>
          <li>البيع: العرف الأكثر انتشاراً 2.5% من البائع و2.5% من المشتري، دون احتساب الضريبة. وتختلف حسب المدن: في الشمال 4% فأكثر حسب دراسة قضائية، وفي الدار البيضاء بين 1% و2.5%، وفي مراكش من 2.5% إلى 5%.</li>
          <li>الكراء الطويل: شهر كراء من المكتري وشهر من المالك. وفي بعض المدن شهر واحد يُقسم مناصفة.</li>
          <li>الكراء القصير: ربع شهر كراء عن ثلاثة أشهر، ونصف شهر عن ستة أشهر. وتسيير الكراء 10% من الكراء الشهري.</li>
          <li>بين الوكالات والوسطاء: المعمول به قسمة العمولة مناصفة بين جانب العقار وجانب الزبون، وتُقسم حصة الجانب بالتساوي إن تعدد الوسطاء.</li>
          <li>المُرشد الذي يكتفي بإعطاء المعلومة: بين 5% و15% من عمولة الوكالة، وغالباً 10%.</li>
          <li>المحاكم لا تأخذ دائماً بالعرف إن لم يُكتب. اكتب الاتفاق: ورقة الزيارة الموقعة، وتفويض المالك بنسبة العمولة، واتفاق مع كل وسيط.</li>
        </ul>
        <h4 className="mt-5 mb-2 text-xs font-bold text-muted">المصادر</h4>
        <ul className="space-y-1.5 text-xs">
          <Source href="https://valfoncier.ma/honoraires-agence-immobiliere-maroc/">Val Foncier: honoraires d’une agence immobilière au Maroc</Source>
          <Source href="https://www.droitetentreprise.com/18818/">أجرة السمسار بين القواعد العرفية والتدخلات القضائية</Source>
          <Source href="https://armonia-solutions.com/transactions-immobilieres/bareme-commission-agences-immobilieres/">Armonia: barème commission agences immobilières au Maroc 2026</Source>
        </ul>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Legal purchase / sale costs used by the calculators                  */
/* ------------------------------------------------------------------ */
export function FeesTab() {
  const { data } = useSettings()
  const s = data as Settings
  return <FeesForm key={JSON.stringify(s.fees)} value={s.fees} />
}

function FeesForm({ value }: { value: FeeSettings }) {
  const me = useMe()
  const confirm = useConfirm()
  const save = useSaveSettings()
  const [f, setF] = useState<FeeSettings>(value)
  const [showCoef, setShowCoef] = useState(false)
  const up = <K extends keyof FeeSettings>(k: K, patch: Partial<FeeSettings[K]>) => setF((x) => ({ ...x, [k]: { ...(x[k] as object), ...patch } }))

  const persist = async (v: FeeSettings, label: string) => {
    try {
      await save.mutateAsync({ key: 'fees', value: v })
      void logActivity(me, 'update', 'settings', 'fees', { title: label })
      toast.success('تم الحفظ. الحاسبات في الموقع واللوحة تستعمل القيم الجديدة.')
    } catch (e) {
      toast.error(errorText(e))
    }
  }
  const reset = async () => {
    if (!(await confirm({ title: 'استرجاع القيم الرسمية؟', text: `تعود كل النسب إلى ما راجعناه في ${fmtDate(DEFAULT_FEES.reviewed_at)} حسب النصوص الرسمية.`, confirmLabel: 'نعم، استرجع' }))) return
    setF(DEFAULT_FEES)
    await persist(DEFAULT_FEES, 'استرجاع القيم الرسمية للمصاريف')
  }
  const years = Object.keys(f.tpi.coefficients).sort((a, b) => Number(b) - Number(a))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-info/20 bg-info/5 p-4 text-sm text-navy sm:flex-row sm:items-center sm:justify-between">
        <p>
          هذه النسب تستعملها حاسبات الموقع واللوحة. راجعناها حسب النصوص الرسمية في <b>{fmtDate(DEFAULT_FEES.reviewed_at)}</b>. حين يتغير القانون، عدّلها هنا مباشرة.
        </p>
        <Button variant="outline" icon={<RotateCcw className="size-4" />} onClick={() => void reset()}>
          استرجاع القيم الرسمية
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="رسوم التسجيل">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Num label="عقار مبني: سكن، محل، مكتب" value={f.registration.built} onChange={(v) => up('registration', { built: v })} unit="%" />
            <Num label="أرض عارية" value={f.registration.land} onChange={(v) => up('registration', { land: v })} unit="%" />
            <Num label="أول بيع لسكن اجتماعي" value={f.registration.social} onChange={(v) => up('registration', { social: v })} unit="%" />
            <Num label="واجب إضافي على الأداء نقداً" value={f.registration.cash_extra} onChange={(v) => up('registration', { cash_extra: v })} unit="%" />
            <Num label="يطبق إذا تجاوز الثمن" value={f.registration.cash_threshold} onChange={(v) => up('registration', { cash_threshold: v })} unit="درهم" />
            <Field label="ابتداءً من">
              <Input type="date" dir="ltr" className="num" value={f.registration.cash_from} onChange={(e) => up('registration', { cash_from: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card title="المحافظة العقارية">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Num label="تسجيل البيع" value={f.conservation.rate} onChange={(v) => up('conservation', { rate: v })} unit="%" />
            <Num label="وجيبة ثابتة عن كل رسم" value={f.conservation.fixed} onChange={(v) => up('conservation', { fixed: v })} unit="درهم" />
            <Num label="أدنى ما يستوفى" value={f.conservation.min} onChange={(v) => up('conservation', { min: v })} unit="درهم" />
            <Num label="شهادة الملكية" value={f.conservation.certificate} onChange={(v) => up('conservation', { certificate: v })} unit="درهم" />
          </div>
        </Card>

        <Card title="الموثق: تقدير">
          <p className="mb-3 text-xs text-muted">لا يوجد سلم منشور ساري المفعول لأتعاب الموثقين، وتُتفق معهم. هذا متوسط المعمول به.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Num label="الأتعاب" value={f.notary.rate} onChange={(v) => up('notary', { rate: v })} unit="% من الثمن" />
            <Num label="حد أدنى للأتعاب" value={f.notary.min} onChange={(v) => up('notary', { min: v })} unit="درهم" />
            <Num label="الضريبة على الأتعاب" value={f.notary.vat} onChange={(v) => up('notary', { vat: v })} unit="%" />
            <Num label="مصاريف إدارية" value={f.notary.disbursements} onChange={(v) => up('notary', { disbursements: v })} unit="درهم" />
          </div>
        </Card>

        <Card title="القرض والرهن">
          <div className="space-y-2">
            <span className="label">تقييد الرهن بالمحافظة العقارية حسب الشرائح</span>
            {f.loan.brackets.map((b, i) => (
              <div key={i} className="grid grid-cols-2 gap-3">
                <Num
                  label={i === f.loan.brackets.length - 1 ? 'ما فوق ذلك' : 'إلى غاية'}
                  value={b.upTo ?? 0}
                  onChange={(v) => up('loan', { brackets: f.loan.brackets.map((x, j) => (j === i ? { ...x, upTo: i === f.loan.brackets.length - 1 ? null : v } : x)) })}
                  unit="درهم"
                />
                <Num label="النسبة" value={b.rate} onChange={(v) => up('loan', { brackets: f.loan.brackets.map((x, j) => (j === i ? { ...x, rate: v } : x)) })} unit="%" />
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Num label="وجيبة ثابتة للرهن" value={f.loan.fixed} onChange={(v) => up('loan', { fixed: v })} unit="درهم" />
            <Num label="تسجيل عقد الرهن" value={f.loan.registration} onChange={(v) => up('loan', { registration: v })} unit="درهم" />
            <Num label="مصاريف البنك: تقدير" value={f.loan.bank_rate} onChange={(v) => up('loan', { bank_rate: v })} unit="% من القرض" />
            <Num label="الموثق على عقد القرض: تقدير" value={f.loan.notary_rate} onChange={(v) => up('loan', { notary_rate: v })} unit="% من القرض" />
            <Num label="رفع الرهن: المحافظة" value={f.release.conservation} onChange={(v) => up('release', { conservation: v })} unit="درهم" />
            <Num label="رفع الرهن: التسجيل" value={f.release.registration} onChange={(v) => up('release', { registration: v })} unit="درهم" />
          </div>
        </Card>

        <Card title="الضريبة على الربح العقاري">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Num label="سعر الضريبة" value={f.tpi.rate} onChange={(v) => up('tpi', { rate: v })} unit="% من الربح" />
            <Num label="الحد الأدنى" value={f.tpi.min_rate} onChange={(v) => up('tpi', { min_rate: v })} unit="% من الثمن" />
            <Num label="السكن الرئيسي: مدة السكن" value={f.tpi.residence_years} onChange={(v) => up('tpi', { residence_years: v })} unit="سنوات" />
            <Num label="السكن الرئيسي: سقف الإعفاء" value={f.tpi.residence_cap} onChange={(v) => up('tpi', { residence_cap: v })} unit="درهم" />
            <Num label="السكن الاجتماعي: مدة السكن" value={f.tpi.social_years} onChange={(v) => up('tpi', { social_years: v })} unit="سنوات" />
            <Num label="السكن الاجتماعي: سقف الثمن" value={f.tpi.social_cap} onChange={(v) => up('tpi', { social_cap: v })} unit="درهم" />
            <Num label="إعفاء مبيعات السنة حتى" value={f.tpi.small_cap} onChange={(v) => up('tpi', { small_cap: v })} unit="درهم" />
            <Num label="مصاريف الشراء الجزافية" value={f.tpi.flat_costs} onChange={(v) => up('tpi', { flat_costs: v })} unit="% من الثمن" />
          </div>
          <button type="button" onClick={() => setShowCoef(!showCoef)} className="mt-4 text-sm font-semibold text-teal hover:underline">
            {showCoef ? 'إخفاء' : 'عرض وتعديل'} جدول معاملات إعادة التقييم لسنة {f.tpi.coef_year}
          </button>
          {showCoef && (
            <div className="mt-3 space-y-3">
              <Num label="سنة الجدول" value={f.tpi.coef_year} onChange={(v) => up('tpi', { coef_year: v })} unit="" step="1" hint="يصدر جدول جديد كل سنة بقرار من وزير الاقتصاد والمالية في الجريدة الرسمية." />
              <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-line p-3 sm:grid-cols-3">
                {years.map((y) => (
                  <label key={y} className="flex items-center gap-2 text-xs">
                    <span className="num w-10 shrink-0 text-muted">{y}</span>
                    <Input type="number" step="0.001" dir="ltr" className="num h-8 py-1 text-xs" value={f.tpi.coefficients[y]} onChange={(e) => up('tpi', { coefficients: { ...f.tpi.coefficients, [y]: n(e.target.value) } })} />
                  </label>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card title="الدعم المباشر للسكن">
          <Switch checked={f.aid.enabled} onChange={(v) => up('aid', { enabled: v })} label={f.aid.enabled ? 'يظهر في حاسبة الشراء كمعلومة' : 'لا يظهر'} />
          <div className="mt-4 space-y-2">
            {f.aid.tiers.map((t, i) => (
              <div key={i} className="grid grid-cols-2 gap-3">
                <Num label="ثمن السكن إلى غاية" value={t.upTo} onChange={(v) => up('aid', { tiers: f.aid.tiers.map((x, j) => (j === i ? { ...x, upTo: v } : x)) })} unit="درهم" />
                <Num label="مبلغ الدعم" value={t.amount} onChange={(v) => up('aid', { tiers: f.aid.tiers.map((x, j) => (j === i ? { ...x, amount: v } : x)) })} unit="درهم" />
              </div>
            ))}
            <Num label="البرنامج مستمر حتى سنة" value={f.aid.until} onChange={(v) => up('aid', { until: v })} unit="" step="1" />
          </div>
        </Card>
      </div>

      <Card title="المصادر الرسمية" icon={<BookOpen className="size-4" />}>
        <ul className="space-y-1.5 text-sm">
          <Source href="https://www.mre.gov.ma/sites/default/files/2025-07/Guide%20MRE_FR_2025.pdf">المديرية العامة للضرائب: الدليل الجبائي لمغاربة العالم 2025، رسوم التسجيل والضريبة على الربح العقاري</Source>
          <Source href="https://blog.avocats.deloitte.fr/maroc-les-principales-mesures-de-la-loi-de-finances-pour-2026/">قانون المالية 2026 رقم 50-25 والمذكرة 737: الواجب الإضافي 2% وعقود الرهن</Source>
          <Source href="https://www.ancfcc.gov.ma/media/1165/d%C3%A9cret-fixant-le-tarif-des-droits-de-conservation-fonci%C3%A8re.pdf">الوكالة الوطنية للمحافظة العقارية: المرسوم 2.16.375 لتعريفة الوجيبات</Source>
          <Source href="https://caeexperts.ma/blog/coefficients-de-reevaluation-des-profits-fonciers-pour-lannee-2026">معاملات إعادة التقييم لسنة 2026: قرار 6 فبراير 2026، الجريدة الرسمية 7486</Source>
        </ul>
        <div className="mt-5 flex justify-end">
          <Button variant="gold" size="lg" loading={save.isPending} icon={<Save className="size-4" />} onClick={() => void persist({ ...f, reviewed_at: new Date().toISOString().slice(0, 10) }, 'نسب المصاريف والضرائب')}>
            حفظ النسب
          </Button>
        </div>
      </Card>
    </div>
  )
}
