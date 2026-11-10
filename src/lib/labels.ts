import type { CommitmentKind, ExpenseCategory, Recurrence } from '@/types/domain'

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  housing: 'السكن',
  food: 'الأكل والمقاضي',
  transport: 'المواصلات والبنزين',
  bills: 'الفواتير',
  health: 'الصحة',
  education: 'التعليم',
  family: 'العائلة',
  entertainment: 'الترفيه',
  shopping: 'التسوق',
  other: 'أخرى',
}

export const CATEGORY_EMOJI: Record<ExpenseCategory, string> = {
  housing: '🏠', food: '🛒', transport: '⛽', bills: '💡', health: '🩺',
  education: '📚', family: '👨‍👩‍👧', entertainment: '🎉', shopping: '🛍️', other: '📦',
}

export const KIND_LABELS: Record<CommitmentKind, string> = {
  bill: 'فاتورة',
  appointment: 'موعد',
  renewal: 'تجديد',
  installment: 'قسط',
  other: 'أخرى',
}

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: 'مرة واحدة',
  monthly: 'شهري',
  yearly: 'سنوي',
}
