const sarFormatter = new Intl.NumberFormat('ar-SA-u-nu-latn', { maximumFractionDigits: 2, minimumFractionDigits: 0 })

/** يعرض المبلغ بالريال السعودي بأرقام لاتينية (تطابق أرقام الإدخال). */
export function formatSAR(value: number): string {
  const v = Number.isFinite(value) ? value : 0
  return `${sarFormatter.format(roundMoney(v))} ر.س`
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

const ARABIC_DIGITS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
}

/** يحوّل الأرقام العربية/الفارسية والفاصلة العربية إلى صيغة قياسية. */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[٠-٩۰-۹]/g, (d) => ARABIC_DIGITS[d] ?? d)
    .replace(/[٫]/g, '.')
    .replace(/[٬,\s]/g, '')
}

export const MAX_AMOUNT = 100_000_000

/**
 * يقرأ مبلغًا من إدخال المستخدم. يعيد null إذا كان غير صالح.
 * يقبل «١٥٠٫٥» و«1,500» و«1500.25». يرفض السالب وأكثر من خانتين عشريتين.
 */
export function parseAmount(input: string, opts: { allowZero?: boolean } = {}): number | null {
  const s = normalizeDigits(input.trim())
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n) || n > MAX_AMOUNT) return null
  if (n === 0 && !opts.allowZero) return null
  return roundMoney(n)
}
