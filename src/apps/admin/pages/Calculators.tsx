import { Calculator, Receipt, Scale } from 'lucide-react'
import { useState } from 'react'
import { useSettings } from '@/shared/lib/data'
import type { Settings } from '@/shared/lib/types'
import { BuyerCalculator, SellerCalculator, type CostQuote } from '@/shared/ui/calculators'
import { printCostQuote } from '../print'
import { PageHeader, Tabs } from '../ui'

export function Calculators() {
  const { data } = useSettings()
  const s = data as Settings
  const [tab, setTab] = useState<'buyer' | 'seller'>('buyer')
  const print = (q: CostQuote) => printCostQuote(q.title, q.intro, q.rows, q.totals, q.notes, s)
  return (
    <>
      <PageHeader title="حاسبة المصاريف" subtitle="ما يدفعه المشتري زيادة على الثمن، وما يصل البائع صافياً بعد الضريبة. اطبعها للزبون أو أرسلها بالواتساب." icon={<Calculator className="size-6" />} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'buyer', label: <span className="inline-flex items-center gap-1.5"><Receipt className="size-4" /> مصاريف الشراء</span> },
          { value: 'seller', label: <span className="inline-flex items-center gap-1.5"><Scale className="size-4" /> البيع وضريبة الربح</span> },
        ]}
      />
      <div className="mt-6">{tab === 'buyer' ? <BuyerCalculator key="b" onPrint={print} /> : <SellerCalculator key="s" onPrint={print} />}</div>
    </>
  )
}
