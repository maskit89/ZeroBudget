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
  accountId: string | null
  accountName: string | null
  isSplit: boolean
  splits: TransactionSplitDto[]
}

// Matches Domain.Enums.AccountType (serialized as a number).
export const AccountType = {
  Current: 0,
  Savings: 1,
  Cash: 2,
  CreditCard: 3,
  Other: 4,
} as const

export const ACCOUNT_TYPE_LABELS: Record<number, string> = {
  0: 'Current',
  1: 'Savings',
  2: 'Cash',
  3: 'Credit card',
  4: 'Other',
}

export interface AccountDto {
  id: string
  name: string
  /** Numeric AccountType. */
  type: number
  currency: string
  openingBalance: number
  /** Opening balance plus the net of the account's transactions. */
  currentBalance: number
  displayOrder: number
}

export interface BudgetTrendPointDto {
  year: number
  month: number
  key: string
  /** Budgeted income (Σ income planned). */
  income: number
  /** Actually-received income (Σ income actuals). */
  incomeReceived: number
  /** Budgeted spending (Σ non-income planned). */
  planned: number
  /** Actual spending (Σ non-income actuals). */
  spent: number
}

export interface BudgetTrendsDto {
  points: BudgetTrendPointDto[]
  totalIncome: number
  totalIncomeReceived: number
  totalSpent: number
}

export interface AnnualMonthDto {
  month: number
  key: string
  hasBudget: boolean
  income: number
  planned: number
  spent: number
}

export interface AnnualSummaryDto {
  year: number
  months: AnnualMonthDto[]
  totalIncome: number
  totalPlanned: number
  totalSpent: number
}

export interface BudgetTemplateGroupDto {
  name: string
  kind: 'Income' | 'Expense' | 'Fund'
  lines: string[]
}

export interface BudgetTemplateDto {
  key: string
  name: string
  description: string
  groups: BudgetTemplateGroupDto[]
}

// Matches Domain.Enums.FundKind (serialized as a number).
export const FundKind = { Annual: 0, Commitment: 1, Goal: 2 } as const

export const FUND_KIND_LABELS: Record<number, string> = {
  0: 'Annual',
  1: 'Commitment',
  2: 'Goal',
}

// Matches Domain.Enums.AccrualMethod (serialized as a number).
export const AccrualMethod = { StraightLine: 0, TargetByDate: 1, ProportionalPool: 2, DailyRate: 3 } as const

export const ACCRUAL_METHOD_LABELS: Record<number, string> = {
  0: 'Straight line (÷ 12)',
  1: 'By target date',
  2: 'Proportional pool',
  3: 'Daily rate',
}

export interface SinkingFundDto {
  id: string
  name: string
  /** Numeric FundKind. */
  kind: number
  targetAmount: number
  /** ISO date (yyyy-MM-dd) or null. */
  targetDate: string | null
  coverStart: string | null
  coverEnd: string | null
  /** Numeric AccrualMethod. */
  accrual: number
  recurAnnually: boolean
  openingBalance: number
  openingAsOf: string | null
  fundingAccountId: string | null
  isArchived: boolean
  /** Opening balance plus every contribution minus every spend, across all months. */
  currentBalance: number
  /** What to put in this month, per the fund's accrual method. */
  requiredMonthlyContribution: number
  /** When the fund reaches its target at the required rate; null when funded/open-ended. */
  projectedFullyFundedDate: string | null
  /** Overspent | Unfunded | FullyFunded | Behind | OnTrack. */
  status: string
}

/** Toggles for the beyond-EveryDollar features (from GET /api/features). */
export interface FeatureFlags {
  accounts: boolean
  multiCurrency: boolean
  camtImport: boolean
  reports: boolean
  sinkingFunds: boolean
}

export interface AuthResponse {
  token: string
  expiresAtUtc: string
  userId: string
  email: string
}
