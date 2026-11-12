/** Privacy-first CSV bank statement parser. Never sends statement contents to a server. */
export interface BankCsvTransaction {
  date: string
  merchant: string
  amount: number
  fingerprint: string
}
export interface BankCsvPreview {
  transactions: BankCsvTransaction[]
  rejectedRows: number
  duplicates: number
}
const digits = '٠١٢٣٤٥٦٧٨٩'
function ascii(value: string): string {
  return value.replace(/[٠-٩]/g, digit => String(digits.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
}
function csvRows(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  const source = input.replace(/^\uFEFF/, '')
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (ch === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++ }
      else quoted = !quoted
    } else if (ch === ',' && !quoted) { row.push(cell.trim()); cell = '' }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && source[i + 1] === '\n') i++
      row.push(cell.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []; cell = ''
    } else cell += ch
  }
  if (quoted) throw new Error('Unclosed CSV quotation')
  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}
function normalizeDate(raw: string): string | null {
  const value = ascii(raw.trim())
  const match = /^(\d{4})[-/]([0-9]{1,2})[-/]([0-9]{1,2})$/.exec(value)
  if (!match) return null
  const [, year, month, day] = match
  const y = Number(year), m = Number(month), d = Number(day)
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}
function parseAmount(raw: string): number | null {
  const value = ascii(raw).replace(/\s/g, '').replace(/[٬,]/g, '').replace(/٫/g, '.')
  if (!/^-?\d+(\.\d{1,2})?$/.test(value)) return null
  const amount = Number(value)
  return Number.isSafeInteger(Math.round(amount * 100)) && amount > 0 ? amount : null
}
const headers = {
  date: ['date', 'transaction date', 'التاريخ', 'تاريخ العملية'],
  merchant: ['merchant', 'description', 'details', 'التاجر', 'الوصف', 'البيان'],
  amount: ['amount', 'debit', 'المبلغ', 'مدين', 'المبلغ المدين'],
}
export function previewBankCsv(input: string, existingFingerprints: ReadonlySet<string> = new Set()): BankCsvPreview {
  const rows = csvRows(input)
  if (!rows.length) return { transactions: [], rejectedRows: 0, duplicates: 0 }
  const header = rows[0].map(value => value.trim().toLowerCase())
  const index = (key: keyof typeof headers) => header.findIndex(value => headers[key].includes(value))
  const dateCol = index('date'), merchantCol = index('merchant'), amountCol = index('amount')
  if ([dateCol, merchantCol, amountCol].some(i => i < 0)) throw new Error('Required CSV columns: date, merchant/description, amount/debit')
  const seen = new Set(existingFingerprints)
  const transactions: BankCsvTransaction[] = []
  let rejectedRows = 0, duplicates = 0
  for (const row of rows.slice(1)) {
    const date = normalizeDate(row[dateCol] ?? '')
    const merchant = (row[merchantCol] ?? '').trim().replace(/\s+/g, ' ').slice(0, 160)
    const amount = parseAmount(row[amountCol] ?? '')
    if (!date || !merchant || amount === null) { rejectedRows++; continue }
    // Same-day identical purchases can be legitimate; flag for manual review rather than silently importing twice.
    const fingerprint = `${date}|${merchant.toLocaleLowerCase()}|${Math.round(amount * 100)}`
    if (seen.has(fingerprint)) { duplicates++; continue }
    seen.add(fingerprint)
    transactions.push({ date, merchant, amount, fingerprint })
  }
  return { transactions, rejectedRows, duplicates }
}
