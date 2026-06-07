// Mirrors the API DTOs (ZeroBudget.Application.Budgets.Dtos).

export interface BudgetItemDto {
  id: string
  name: string
  displayOrder: number
  plannedAmount: number
  actualAmount: number
  remaining: number
}

export interface BudgetCategoryDto {
  id: string
  name: string
  kind: 'Income' | 'Expense'
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

// Matches Domain.Enums.TransactionType (System.Text.Json serializes as a number).
export const TransactionType = { Expense: 0, Income: 1 } as const

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
