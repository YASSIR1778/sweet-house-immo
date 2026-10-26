import type { Permission, Role } from '@/shared/lib/types'

/** What a member may do besides the daily work. Admins can do everything and manage the team. */
export const PERMISSIONS: { key: Permission; label: string; hint: string }[] = [
  { key: 'properties', label: 'إضافة وتعديل العقارات', hint: 'إنشاء العقارات، تعديلها، نشرها على الموقع ورفع صورها' },
  { key: 'delete', label: 'الحذف', hint: 'حذف العقارات والعملاء والطلبات' },
  { key: 'deals', label: 'الصفقات والعمولات', hint: 'رؤية الصفقات والعمولات وتسجيلها' },
  { key: 'reports', label: 'لوحة القيادة', hint: 'الأرقام والإحصائيات العامة للوكالة' },
  { key: 'export', label: 'تصدير البيانات', hint: 'تحميل القوائم كملفات Excel والنسخة الاحتياطية' },
  { key: 'settings', label: 'إعدادات الموقع', hint: 'نصوص الموقع وصوره، الأحياء ومعلومات الوكالة' },
  { key: 'activity', label: 'سجل النشاط', hint: 'من قام بماذا ومتى' },
]

export const PERMISSION_LABEL = Object.fromEntries(PERMISSIONS.map((p) => [p.key, p.label])) as Record<Permission, string>

/** Default for a new employee: the daily work plus adding / editing properties. */
export const DEFAULT_PERMISSIONS: Permission[] = ['properties']

export const DAILY_WORK = 'الطلبات، العملاء، المواعيد، المهام، المكالمات ورؤية العقارات'

export function can(user: { role: Role; active?: boolean; permissions?: Permission[] | null } | null | undefined, p: Permission): boolean {
  if (!user || user.active === false) return false
  return user.role === 'admin' || (user.permissions ?? []).includes(p)
}

export const JOB_TITLES = ['كاتبة', 'سكرتيرة', 'مسؤولة الاستقبال', 'وكيل عقاري', 'مسؤول الزيارات', 'مسؤول التسويق', 'محاسب', 'مدير مساعد']
