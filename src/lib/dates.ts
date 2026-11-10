import type { ISODate } from '@/types/domain'

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now)
}

export function isISODate(s: string): s is ISODate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number) as [number, number, number]
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

function parts(iso: ISODate): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return [y, m, d]
}

/** عدد الأيام من a إلى b (موجب إذا كان b بعد a). مستقل عن التوقيت الصيفي. */
export function daysBetween(a: ISODate, b: ISODate): number {
  const [ay, am, ad] = parts(a)
  const [by, bm, bd] = parts(b)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate()
}

export function addDays(iso: ISODate, n: number): ISODate {
  const [y, m, d] = parts(iso)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

/** يضيف أشهرًا مع تثبيت اليوم على آخر يوم في الشهر عند الحاجة (31 يناير + 1 = 28/29 فبراير). */
export function addMonths(iso: ISODate, n: number, anchorDay?: number): ISODate {
  const [y, m, d] = parts(iso)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const day = Math.min(anchorDay ?? d, daysInMonth(ny, nm))
  return `${ny}-${pad(nm)}-${pad(day)}`
}

export function monthRange(iso: ISODate): { from: ISODate; to: ISODate } {
  const [y, m] = parts(iso)
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(daysInMonth(y, m))}` }
}

/** نسبة الأيام المنقضية من الشهر، شاملة اليوم الحالي (0..1]. */
export function monthElapsedRatio(iso: ISODate): number {
  const [y, m, d] = parts(iso)
  return d / daysInMonth(y, m)
}

export function daysLeftInMonth(iso: ISODate): number {
  const [y, m, d] = parts(iso)
  return daysInMonth(y, m) - d + 1
}

/** عدد الأشهر (كسري، ≥0) بين تاريخين. */
export function monthsBetween(a: ISODate, b: ISODate): number {
  return Math.max(0, daysBetween(a, b) / 30.4375)
}

function asLocalNoon(iso: ISODate): Date {
  const [y, m, d] = parts(iso)
  return new Date(y, m - 1, d, 12)
}

const gregorian = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' })
const gregorianShort = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short' })
const weekday = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { weekday: 'long' })
const hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' })

export const formatDate = (iso: ISODate) => gregorian.format(asLocalNoon(iso))
export const formatShortDate = (iso: ISODate) => gregorianShort.format(asLocalNoon(iso))
export const formatWeekday = (iso: ISODate) => weekday.format(asLocalNoon(iso))
export const formatHijri = (iso: ISODate) => hijri.format(asLocalNoon(iso))

/** «اليوم»، «بكرة»، «بعد 3 أيام»، «متأخر يومين»... */
export function relativeDayLabel(days: number): string {
  if (days === 0) return 'اليوم'
  if (days === 1) return 'بكرة'
  if (days === -1) return 'أمس'
  const n = Math.abs(days)
  const unit = n === 2 ? 'يومين' : n <= 10 ? `${n} أيام` : `${n} يوم`
  return days > 0 ? `بعد ${unit}` : `متأخر ${unit}`
}
