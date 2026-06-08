// Mirrors the API DTOs (ZeroBudget.Application.Budgets.Dtos).

export interface BudgetItemDto {
  id: string
  name: string
  displayOrder: number
  plannedAmount: number
  actualAmount: number
  remaining: number
  /** True when actualAmount is transaction-driven (read-only); false when it's the manual value (editable). */
  isActualTracked: boolean
  /** Sinking-fund identity for a fund line; null for ordinary lines. */
  fundId: string | null
  /** For a fund line, the running available balance (rolled over from prior months); null otherwise. */
  fundAvailable: number | null
  /** Day of the month (1–31) this bill is due; null when the line isn't a bill. */
  dueDay: number | null
  /** Whether this month's instance of the bill has been paid. */
  isPaid: boolean
}

export interface BudgetCategoryDto {
  id: string
  name: string
  kind: 'Income' | 'Expense' | 'Fund'
  displayOrder: number
  totalPlanned: number
  totalActual: number
  items: BudgetItemDto[]
}

export interface BudgetMonthDto {
  id: string
  key: string
  year: number
  month: number
  baseCurrency: string
  totalIncome: number
  totalPlanned: number
  remainingToBudget: number
  isBalanced: boolean
  categories: BudgetCategoryDto[]
}

export interface BudgetMonthSummaryDto {
  year: number
  month: number
  key: string
}

// Matches Domain.Enums.TransactionType (System.Text.Json serializes as a number).
export const TransactionType = { Expense: 0, Income: 1 } as const

export interface TransactionSplitDto {
  id: string
  budgetItemId: string | null
  budgetItemName: string | null
  amount: number
}

export interface TransactionDto {
  id: string
  date: string
  payee: string
  amount: number
  currency: string
  exchangeRate: number
  baseAmount: number
  type: number
  bankReference: string | null
  budgetItemId: string | null
  budgetItemName: string | null
  isSplit: boolean
  splits: TransactionSplitDto[]
}

export interface BudgetTrendPointDto {
  year: number
  month: number
  key: string
  /** Budgeted income (Σ income planned). */
  income: number
  /** Budgeted spending (Σ non-income planned). */
  planned: number
  /** Actual spending (Σ non-income actuals). */
  spent: number
}

export interface BudgetTrendsDto {
  points: BudgetTrendPointDto[]
  totalIncome: number
  totalSpent: number
}

export interface ImportStatementResult {
  totalEntries: number
  imported: number
  skippedDuplicates: number
  credits: number
  debits: number
  iban: string | null
  autoCategorized: number
}

export interface AuthResponse {
  token: string
  expiresAtUtc: string
  userId: string
  email: string
}
