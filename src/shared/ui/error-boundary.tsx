import { Component, type ReactNode } from 'react'

const isChunkError = (e: unknown) => /dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically/i.test(String((e as Error)?.message ?? e))

/** Never leave a blank page: after an update (or any crash) offer a reload. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    const chunk = isChunkError(this.state.error)
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-lg font-bold text-navy">{chunk ? 'تم تحديث الموقع. أعد تحميل الصفحة للمتابعة.' : 'حدث خطأ غير متوقع في هذه الصفحة.'}</p>
        <p className="text-sm text-muted" dir="ltr">
          {chunk ? 'Le site a été mis à jour : rechargez la page.' : String((this.state.error as Error)?.message ?? this.state.error).slice(0, 160)}
        </p>
        <button onClick={() => location.reload()} className="mt-2 rounded-xl bg-navy px-6 py-3 text-sm font-bold text-white shadow-soft hover:bg-navy-800">
          إعادة التحميل · Recharger
        </button>
      </div>
    )
  }
}
