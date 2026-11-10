import { addDays, monthRange, todayISO } from '@/lib/dates'
import type { DemoState } from './demoRepository'

/** بيانات تجريبية واقعية لحساب «الضيف» فقط. الحسابات التجريبية الجديدة تبدأ فارغة. */
export function buildDemoSeed(userId: string, now: Date = new Date()): DemoState {
  const today = todayISO(now)
  const { from } = monthRange(today)
  const id = () => crypto.randomUUID()
  const created = now.toISOString()
  const inMonth = (offset: number) => {
    const d = addDays(from, offset)
    return d > today ? today : d
  }
  return {
    profile: { id: userId, displayName: 'ضيف دبّر', monthlyIncome: 9500, savingsTarget: 1000, payday: 27 },
    expenses: [
      { id: id(), amount: 2500, category: 'housing', note: 'الإيجار', spentOn: inMonth(0), createdAt: created },
      { id: id(), amount: 420, category: 'food', note: 'مقاضي الأسبوع', spentOn: inMonth(2), createdAt: created },
      { id: id(), amount: 180, category: 'transport', note: 'بنزين', spentOn: inMonth(4), createdAt: created },
      { id: id(), amount: 310, category: 'bills', note: 'فاتورة الكهرباء', spentOn: inMonth(6), createdAt: created },
      { id: id(), amount: 95, category: 'entertainment', note: 'سينما', spentOn: inMonth(8), createdAt: created },
    ],
    limits: [
      { category: 'food', monthlyLimit: 1500 },
      { category: 'transport', monthlyLimit: 600 },
      { category: 'entertainment', monthlyLimit: 400 },
    ],
    commitments: [
      { id: id(), title: 'قسط السيارة', kind: 'installment', dueDate: addDays(today, 2), dueTime: null, amount: 1450, recurrence: 'monthly', done: false, notes: null },
      { id: id(), title: 'تجديد الاستمارة', kind: 'renewal', dueDate: addDays(today, 20), dueTime: null, amount: 150, recurrence: 'yearly', done: false, notes: 'عبر أبشر' },
      { id: id(), title: 'موعد الأسنان', kind: 'appointment', dueDate: today, dueTime: '17:30', amount: null, recurrence: 'none', done: false, notes: null },
      { id: id(), title: 'فاتورة الجوال', kind: 'bill', dueDate: addDays(today, -1), dueTime: null, amount: 230, recurrence: 'monthly', done: false, notes: null },
    ],
    goals: [
      { id: id(), name: 'صندوق الطوارئ', targetAmount: 20000, currentAmount: 6500, targetDate: addDays(today, 365) },
      { id: id(), name: 'رحلة الصيف', targetAmount: 8000, currentAmount: 1200, targetDate: addDays(today, 180) },
    ],
  }
}
