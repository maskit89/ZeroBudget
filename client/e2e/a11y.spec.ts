import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type Route } from '@playwright/test'

// The WCAG 2.x success criteria we assert against (A + AA, through 2.2).
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const FLAGS = { accounts: true, multiCurrency: true, camtImport: true, reports: true, sinkingFunds: true, householdAllocation: true }

function householdMembers() {
  return [
    { id: 'm1', name: 'Chris', netMonthlyIncome: 6000, personalSavingsAccountId: null, displayOrder: 0, isArchived: false, incomeSharePct: 0.6 },
    { id: 'm2', name: 'Liza', netMonthlyIncome: 4000, personalSavingsAccountId: null, displayOrder: 1, isArchived: false, incomeSharePct: 0.4 },
  ]
}

// A couple of sinking funds so the /funds page renders cards, badges and progress
// bars (incl. an overspent one) for axe to scan in both themes.
function sinkingFunds() {
  return [
    { id: 'f1', name: 'Home insurance', kind: 1, targetAmount: 300, targetDate: '2026-12-01', coverStart: null, coverEnd: null, accrual: 0, recurAnnually: true, openingBalance: 0, openingAsOf: null, fundingAccountId: null, isArchived: false, currentBalance: 120, requiredMonthlyContribution: 25, projectedFullyFundedDate: '2026-11-01', status: 'OnTrack' },
    { id: 'f2', name: 'Holiday', kind: 0, targetAmount: 1000, targetDate: null, coverStart: null, coverEnd: null, accrual: 1, recurAnnually: false, openingBalance: 0, openingAsOf: null, fundingAccountId: null, isArchived: false, currentBalance: -40, requiredMonthlyContribution: 0, projectedFullyFundedDate: null, status: 'Overspent' },
  ]
}

// A small but representative budget: income, an expense line that is also a bill,
// and a sinking fund — so the dashboard renders the full grid (groups, rows,
// inline inputs, the bill pill and the bills banner) for axe to scan.
function budgetMonth(year: number, month: number) {
  return {
    id: 'm1',
    key: `${year}-${String(month).padStart(2, '0')}`,
    year,
    month,
    baseCurrency: 'EUR',
    totalIncome: 3000,
    totalPlanned: 1300,
    remainingToBudget: 1700,
    isBalanced: false,
    categories: [
      {
        id: 'inc', name: 'Income', kind: 'Income', displayOrder: 0, totalPlanned: 3000, totalActual: 3000,
        items: [{ id: 'i-pay', name: 'Take-home Pay', displayOrder: 0, plannedAmount: 3000, actualAmount: 3000, remaining: 0, isActualTracked: false, fundId: null, fundAvailable: null, dueDay: null, isPaid: false }],
      },
      {
        id: 'c1', name: 'Housing', kind: 'Expense', displayOrder: 0, totalPlanned: 1100, totalActual: 200,
        items: [{ id: 'i-rent', name: 'Rent', displayOrder: 0, plannedAmount: 1100, actualAmount: 200, remaining: 900, isActualTracked: false, fundId: null, fundAvailable: null, dueDay: 1, isPaid: false }],
      },
      {
        id: 'f1', name: 'Sinking Funds', kind: 'Fund', displayOrder: 1, totalPlanned: 200, totalActual: 0,
        items: [{ id: 'i-car', name: 'Car', displayOrder: 0, plannedAmount: 200, actualAmount: 0, remaining: 200, isActualTracked: false, fundId: 'fund-car', fundAvailable: 600, dueDay: null, isPaid: false }],
      },
    ],
  }
}

function allocationProfile() {
  return {
    id: 'p1', name: 'Household allocation', sourceAccountId: 'acc0',
    rules: [
      { id: 'r0', order: 0, type: 0, split: 0, fixedAmountPerMember: 0 },
      { id: 'r1', order: 1, type: 1, split: 0, fixedAmountPerMember: 0 },
      { id: 'r2', order: 2, type: 2, split: 0, fixedAmountPerMember: 250 },
      { id: 'r3', order: 3, type: 3, split: 0, fixedAmountPerMember: 0 },
    ],
  }
}

function allocationPreview() {
  return {
    pool: 8411.61, envelopesTotal: 3641, fundsTotal: 2164, transfersCreated: 0,
    steps: [
      { type: 0, total: 3641, perMember: [{ memberId: 'm1', name: 'Chris', amount: 1820.5 }, { memberId: 'm2', name: 'Liza', amount: 1820.5 }] },
      { type: 3, total: 2106.61, perMember: [{ memberId: 'm1', name: 'Chris', amount: 1259.14 }, { memberId: 'm2', name: 'Liza', amount: 847.47 }] },
    ],
    members: [
      { memberId: 'm1', name: 'Chris', netIncome: 4411.64, residual: 1259.14, savingsAccountId: 'acc1' },
      { memberId: 'm2', name: 'Liza', netIncome: 3999.97, residual: 847.47, savingsAccountId: 'acc2' },
    ],
  }
}

function accountsList() {
  return [
    { id: 'acc0', name: 'Joint Current', type: 0, currency: 'EUR', openingBalance: 1000, currentBalance: 1200, displayOrder: 0 },
    { id: 'acc1', name: 'Savings Joint', type: 1, currency: 'EUR', openingBalance: 0, currentBalance: 5000, displayOrder: 1 },
  ]
}

function accountReconciliation() {
  return [
    { accountId: 'acc1', accountName: 'Savings Joint', currentBalance: 5000, backedFundsTotal: 3000, backedFundCount: 2, float: 2000 },
  ]
}

// Stub every /api call so the SPA renders content without a backend.
async function mockApi(route: Route) {
  const path = new URL(route.request().url()).pathname.replace(/^\/api/, '')
  const json = (body: unknown) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

  if (path === '/features') return json(FLAGS)
  if (path === '/budget/current') return json(budgetMonth(2026, 6))
  if (/^\/budget\/\d+\/\d+$/.test(path)) {
    const [, , y, m] = path.split('/')
    return json(budgetMonth(Number(y), Number(m)))
  }
  if (path === '/accounts') return json(accountsList())
  if (path === '/accounts/reconciliation') return json(accountReconciliation())
  if (path === '/sinkingfunds') return json(sinkingFunds())
  if (path === '/members') return json(householdMembers())
  if (path === '/allocation/profile') return json(allocationProfile())
  if (/^\/allocation\/preview\/\d+\/\d+$/.test(path)) return json(allocationPreview())
  if (path === '/budget/months') return json([])
  if (path === '/budget/templates') return json([])
  if (path === '/reports/trends') return json({ points: [], totalIncome: 0, totalIncomeReceived: 0, totalSpent: 0 })
  if (/^\/reports\/annual\/\d+$/.test(path)) return json({ year: 2026, months: [], totalIncome: 0, totalPlanned: 0, totalSpent: 0 })
  return json([]) // transactions, accounts, anything else → empty
}

async function authedSetup(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript((t) => {
    localStorage.setItem('zbb.theme', t as string)
    localStorage.setItem('zbb.token', 'e2e-token')
    localStorage.setItem('zbb.email', 'e2e@zerobudget.app')
  }, theme)
  await page.route('**/api/**', mockApi)
}

async function expectNoViolations(page: Page) {
  await page.waitForLoadState('networkidle')
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  const summary = violations.map((v) => `${v.id} (${v.impact}) ×${v.nodes.length}`).join('\n')
  expect(violations, summary).toEqual([])
}

const AUTHED_ROUTES = ['/', '/transactions', '/accounts', '/funds', '/members', '/allocation', '/reports', '/help']

for (const theme of ['light', 'dark'] as const) {
  test.describe(`a11y — ${theme}`, () => {
    for (const path of AUTHED_ROUTES) {
      test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
        await authedSetup(page, theme)
        await page.goto(path)
        await page.getByRole('heading', { level: 1 }).first().waitFor()
        await expectNoViolations(page)
      })
    }

    test('login has no WCAG A/AA violations', async ({ page }) => {
      // Signed out: no token, so the login page renders.
      await page.addInitScript((t) => localStorage.setItem('zbb.theme', t as string), theme)
      await page.route('**/api/**', mockApi)
      await page.goto('/login')
      await page.getByLabel('Email').waitFor()
      await expectNoViolations(page)
    })
  })
}
