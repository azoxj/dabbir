import type {
  BudgetLimit, Commitment, Expense, ExpenseCategory, ExpensePatch, ISODate, NewCommitment, NewExpense,
  NewSavingsGoal, Profile, ProfilePatch, SavingsGoal,
} from '@/types/domain'

/** واجهة موحّدة للبيانات: Supabase أو تخزين محلي تجريبي. كل الاستدعاءات تخص المستخدم الحالي فقط. */
export interface DataRepository {
  getProfile(): Promise<Profile>
  updateProfile(patch: ProfilePatch): Promise<Profile>

  listExpenses(range: { from: ISODate; to: ISODate }): Promise<Expense[]>
  addExpense(input: NewExpense): Promise<Expense>
  updateExpense(id: string, patch: ExpensePatch): Promise<Expense>
  deleteExpense(id: string): Promise<void>

  listBudgetLimits(): Promise<BudgetLimit[]>
  setBudgetLimit(category: ExpenseCategory, monthlyLimit: number): Promise<void>
  removeBudgetLimit(category: ExpenseCategory): Promise<void>

  listCommitments(): Promise<Commitment[]>
  addCommitment(input: NewCommitment): Promise<Commitment>
  updateCommitment(id: string, patch: Partial<Omit<Commitment, 'id'>>): Promise<Commitment>
  deleteCommitment(id: string): Promise<void>

  listGoals(): Promise<SavingsGoal[]>
  addGoal(input: NewSavingsGoal): Promise<SavingsGoal>
  updateGoal(id: string, patch: Partial<Omit<SavingsGoal, 'id' | 'currentAmount'>>): Promise<SavingsGoal>
  /** إيداع (موجب) أو سحب (سالب) ذري. لا ينزل الرصيد تحت الصفر. */
  adjustGoal(id: string, delta: number): Promise<SavingsGoal>
  deleteGoal(id: string): Promise<void>

  /** «مسح جميع بياناتي»: يحذف المصاريف والحدود والالتزامات والأهداف ويصفّر أرقام الملف (يبقى الحساب والاسم). */
  clearAllData(): Promise<void>
}
