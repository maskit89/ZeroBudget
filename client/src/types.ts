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
  totalIncome: number
  totalPlanned: number
  remainingToBudget: number
  isBalanced: boolean
  categories: BudgetCategoryDto[]
}

export interface AuthResponse {
  token: string
  expiresAtUtc: string
  userId: string
  email: string
}
