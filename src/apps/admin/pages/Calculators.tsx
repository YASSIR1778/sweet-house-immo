import { Calculator, Gauge, Printer, Receipt, Scale } from 'lucide-react'
import { useState } from 'react'
import { useSettings, useTable } from '@/shared/lib/data'
import type { Property, Settings } from '@/shared/lib/types'
import type { ValuationInput } from '@/shared/lib/valuation'
import { Button } from '@/shared/ui/base'
import { BuyerCalculator, SellerCalculator, type CostQuote } from '@/shared/ui/calculators'
import { DEFAULT_VALUATION, EstimateResult, EstimatorForm, useEstimate } from '@/shared/ui/estimator'
import { useNames } from '../hooks'
import { printCostQuote, printValuation } from '../print'
import { PageHeader, Tabs } from '../ui'

type Tab = 'buyer' | 'seller' | 'value'

export function Calculators() {
  const { data } = useSettings()
  const s = data as Settings
  const [tab, setTab] = useState<Tab>('buyer')
  const print = (q: CostQuote) => printCostQuote(q.title, q.intro, q.rows, q.totals, q.notes, s)
  return (
    <>
      <PageHeader title="الحاسبات والتقدير" subtitle="مصاريف الشراء، صافي البائع بعد الضريبة، وتقدير ثمن عقار من العقارات المشابهة. اطبعها للزبون أو أرسلها بالواتساب." icon={<Calculator className="size-6" />} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'buyer', label: <span className="inline-flex items-center gap-1.5"><Receipt className="size-4" /> مصاريف الشراء</span> },
          { value: 'seller', label: <span className="inline-flex items-center gap-1.5"><Scale className="size-4" /> البيع وضريبة الربح</span> },
          { value: 'value', label: <span className="inline-flex items-center gap-1.5"><Gauge className="size-4" /> تقدير الثمن</span> },
        ]}
      />
      <div className="mt-6">
        {tab === 'buyer' && <BuyerCalculator key="b" onPrint={print} />}
        {tab === 'seller' && <SellerCalculator key="s" onPrint={print} />}
        {tab === 'value' && <Valuation />}
      </div>
    </>
  )
}

/** The agent's estimate: every property of the agency is a comparable (sold, reserved, hidden ones too). */
function Valuation() {
  const { s, hoodName } = useNames()
  const { data: props = [] } = useTable<Property>('properties')
  const [input, setInput] = useState<ValuationInput>(DEFAULT_VALUATION)
  const est = useEstimate(input, props)
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div className="card p-5">
        <EstimatorForm value={input} onChange={setInput} />
        <p className="mt-4 text-xs text-muted">الأثمنة المرجعية لكل حي تُعدَّل من الإعدادات ← المناطق والمراجع، وتُستعمل حين تقل العروض المشابهة.</p>
      </div>
      <EstimateResult
        input={input}
        est={est}
        compHref={(ref) => {
          const p = props.find((x) => x.ref === ref)
          return p ? `/admin/properties/${p.id}` : '/admin/properties'
        }}
        footer={
          est && (
            <Button variant="outline" icon={<Printer className="size-4" />} onClick={() => printValuation(input, est, s, hoodName)}>
              طباعة رأي في القيمة للمالك
            </Button>
          )
        }
      />
    </div>
  )
}
