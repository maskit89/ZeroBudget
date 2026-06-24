import type { ReactNode } from 'react'
import { AppShell } from '../components/AppShell'
import { Button, Card, PageHeader } from '../components/ui'
import { useOnboarding } from '../onboarding/OnboardingContext'

const GUIDE_URL = 'https://github.com/maskit89/ZeroBudget/blob/main/docs/USER_GUIDE.md'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card as="section" className="p-5">
      <h3 className="mb-2 text-sm font-semibold text-slate-800">{title}</h3>
      <div className="space-y-1.5 text-sm leading-relaxed text-slate-600">{children}</div>
    </Card>
  )
}

export function HelpPage() {
  const { replay } = useOnboarding()
  return (
    <AppShell>
      <PageHeader
        title="Help & guide"
        subtitle={
          <>
            A quick tour of the portal. For the full manual, see the{' '}
            <a
              href={GUIDE_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand-600 hover:underline dark:text-emerald-400"
            >
              complete user guide
            </a>
            .
          </>
        }
        actions={
          <Button variant="secondary" size="sm" onClick={replay}>
            Replay welcome tour
          </Button>
        }
      />

      {/* The core idea + a monthly rhythm to follow. */}
      <Section title="Zero-based budgeting in a nutshell">
        <p>
          Give <strong>every euro of income a job before you spend it</strong>. Enter what you expect to
          earn, assign all of it across your spending lines and savings funds, and drive the big banner's{' '}
          <strong>Remaining to Budget</strong> to exactly <strong>€0.00</strong> — green means every euro is
          assigned.
        </p>
        <ol className="ml-5 list-decimal space-y-1">
          <li>Create the month (copy last month, start blank, or pick a template).</li>
          <li>Adjust planned amounts until the banner turns green.</li>
          <li>During the month, add transactions and tick bills as you pay them.</li>
          <li>Review the Reports page at month-end.</li>
        </ol>
      </Section>

      <Section title="Budget">
        <p>
          Your plan for one month. Move between months with ◀ / ▶. Each line shows{' '}
          <strong>Planned</strong>, <strong>Spent</strong> and <strong>Remaining</strong> — click any name or
          amount to edit it inline (Enter saves, Escape cancels). Add groups and lines, reorder with ▲ / ▼,
          and delete with ✕ (deleting a line never deletes its transactions — they just become unassigned).
        </p>
        <p>
          A line's <strong>Spent</strong> is either typed in by hand (✎) or totalled live from the
          transactions assigned to it (🔗) — assigning a transaction switches the line to tracking
          automatically.
        </p>
      </Section>

      <Section title="Income, funds & bills">
        <p>
          <strong>Income</strong> lines have a <em>planned</em> amount (the pool to assign) and a{' '}
          <em>received</em> amount. <strong>Funds</strong> (violet) are savings goals whose <em>Available</em>{' '}
          balance rolls over month to month; this month's planned amount is your contribution.
        </p>
        <p>
          Mark any expense line as a <strong>bill</strong> with the 📅 icon and a due day — you'll get a Paid
          checkbox and overdue / due-soon reminders for the current month.
        </p>
      </Section>

      <Section title="Transactions">
        <p>
          The register of real money movements. Add them by hand and assign each to a budget line —{' '}
          <strong>split ⑂</strong> one transaction across several lines, edit ✎ or delete ✕, and filter by
          payee or “unassigned only”. A new transaction with no line picked quietly inherits the line of the
          most recent transaction with the same description, so repeat payees categorize themselves.
        </p>
      </Section>

      <Section title="Accounts">
        <p>
          <strong>Accounts</strong> track where your money sits: set an opening balance and tag transactions
          to an account, and its current balance is derived as opening + income − expenses. The footer shows
          your total net balance across all accounts.
        </p>
      </Section>

      <Section title="Reports">
        <p>
          <strong>Reports</strong> show budgeted vs received income, spending trends, a category breakdown for
          any month, and an annual overview.
        </p>
      </Section>

      <Section title="Good to know">
        <ul className="ml-5 list-disc space-y-1">
          <li>Inline editing everywhere: click, type, Enter to save, Escape to cancel.</li>
          <li>Deleting lines or accounts never deletes your transactions.</li>
          <li>If the banner won't balance, remember funding a sinking fund counts as an assignment.</li>
          <li>Amounts accept both “12.50” and “12,50”; every figure is exact to the cent.</li>
        </ul>
      </Section>
    </AppShell>
  )
}
