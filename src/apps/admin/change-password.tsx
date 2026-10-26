import { KeyRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { getSupabase } from '@/shared/lib/supabase'
import { Button, Field, Input, Modal } from '@/shared/ui/base'

/** Signed-in member replaces the password (e.g. the temporary one given by the owner). */
export function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)

  const close = () => {
    setPw('')
    setPw2('')
    onClose()
  }

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (pw.length < 8) return toast.error('كلمة المرور الجديدة يجب أن تتكون من 8 أحرف على الأقل.')
    if (pw !== pw2) return toast.error('كلمتا المرور غير متطابقتين.')
    setBusy(true)
    const { error } = await getSupabase().auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return toast.error(/same|different/i.test(error.message) ? 'اختر كلمة مرور مختلفة عن الحالية.' : `تعذر التغيير: ${error.message}`)
    toast.success('تم تغيير كلمة المرور')
    close()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="sm"
      title={
        <span className="inline-flex items-center gap-2">
          <KeyRound className="size-5 text-gold-600" /> تغيير كلمة المرور
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            إلغاء
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            حفظ
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">اختر كلمة مرور خاصة بك، 8 أحرف على الأقل، فيها أرقام وحروف.</p>
        <Field label="كلمة المرور الجديدة">
          <Input type="password" dir="ltr" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </Field>
        <Field label="أعد كتابتها">
          <Input type="password" dir="ltr" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
