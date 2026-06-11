# ZeroBudget — User Guide

ZeroBudget is a zero-based budgeting app for Europe: every euro of income gets a job before the month starts. This guide walks through every page of the portal, what each control does, and how the numbers behind them are calculated.

---

## Contents

1. [The idea: zero-based budgeting](#1-the-idea-zero-based-budgeting)
2. [Signing in](#2-signing-in)
3. [The Budget page](#3-the-budget-page)
   - [Creating a month](#creating-a-month)
   - [The Remaining-to-Budget banner](#the-remaining-to-budget-banner)
   - [Income](#income)
   - [Expense groups and lines](#expense-groups-and-lines)
   - [Spent: manual entry vs transaction tracking](#spent-manual-entry-vs-transaction-tracking)
   - [Funds (sinking funds)](#funds-sinking-funds)
   - [Bills and reminders](#bills-and-reminders)
   - [Organising groups and lines](#organising-groups-and-lines)
4. [Paychecks](#4-paychecks)
5. [Transactions](#5-transactions)
   - [Adding a transaction](#adding-a-transaction)
   - [Assigning to a budget line](#assigning-to-a-budget-line)
   - [Splitting a transaction](#splitting-a-transaction)
   - [Editing, deleting, finding](#editing-deleting-finding)
6. [Accounts](#6-accounts)
7. [Importing bank statements](#7-importing-bank-statements)
8. [Auto-categorization rules](#8-auto-categorization-rules)
9. [Reports](#9-reports)
10. [Multi-currency](#10-multi-currency)
11. [Feature flags (for self-hosters)](#11-feature-flags-for-self-hosters)
12. [Everyday tips](#12-everyday-tips)

---

## 1. The idea: zero-based budgeting

In a zero-based budget you don't track spending after the fact — you **assign every euro a job before you spend it**. Each month:

1. Enter the income you expect.
2. Assign all of it across your spending lines (Rent, Groceries, …) and savings funds.
3. The goal is **Remaining to Budget = €0.00** — no money left unassigned, none over-assigned.
4. During the month, record (or import) what you actually spend and compare it to the plan.

ZeroBudget's big banner tracks that goal live as you type.

## 2. Signing in

- Open the portal and you land on the sign-in card. New here? Click **Register**, enter an email and a password of **at least 8 characters**, and you're in — registration signs you in immediately.
- Your session is private: every budget, transaction, account and rule belongs to your login alone.
- **Sign out** is always at the top right.

The navigation bar at the top of every page takes you between **Budget · Paychecks · Transactions · Accounts · Reports · Rules**. (Some items can be switched off by the administrator — see [Feature flags](#11-feature-flags-for-self-hosters).)

## 3. The Budget page

This is the home page — your plan for one calendar month.

### Creating a month

Use the **◀ / ▶** arrows next to the month name to move between months, and **This month** to jump back to today. If the month you're viewing has no budget yet, you'll see three ways to start:

- **Copy last month's budget** — brings over your whole structure and planned amounts (actuals reset to zero, bills reset to unpaid). This is the normal month-to-month flow.
- **Start blank** — an empty budget with just an Income group.
- **Or start from a template** — quick-start layouts (**Essentials**, **Student**, **Family**), each a ready set of groups and lines with amounts at zero for you to fill in.

### The Remaining-to-Budget banner

The large coloured banner shows **Income**, **Assigned**, and the difference — **Remaining to Budget** — recalculated instantly on every edit:

| Colour | Meaning |
|---|---|
| 🟡 Amber — "Still to assign" | Income not yet given a job. Keep assigning. |
| 🟢 Green — "Every Euro has a job 🎉" | Exactly €0.00 left. The budget is balanced. |
| 🔴 Red — "Over-budgeted — trim a category" | You've planned more than you earn. Reduce something. |

**How it works:** Income = the sum of your income lines' *planned* amounts. Assigned = the sum of every expense line *and* every fund contribution. Putting money into a fund counts as giving it a job, so the budget only balances once your funds are funded too.

### Income

The Income group is pinned to the top and can't be deleted. Each income line (e.g. "Salary", "Freelance") has:

- **Planned** — what you expect to receive. This feeds the pool the banner divides up.
- **Received** — what actually arrived. Type it yourself, or click the **✎ / 🔗** toggle to switch the line to *transaction tracking*, where it totals the income transactions you've assigned to it instead.

### Expense groups and lines

Below Income come your expense groups ("Housing", "Food", …). Each line shows **Planned**, **Spent** and **Remaining** (planned − spent; turns negative when overspent). Click any name or amount to edit it in place — **Enter** or clicking away saves, **Escape** cancels.

- **+ Add group** at the bottom creates a new group (choose *Expense* or *Fund*).
- Each group has an "add line" affordance for new lines within it.
- Delete a line or group with **✕** — any transactions assigned to a deleted line simply become unassigned, they are not lost.

### Spent: manual entry vs transaction tracking

Every line's **Spent** value comes from one of two modes, toggled per line:

- **Manual (✎)** — you type the spent amount yourself. Perfect if you don't want to log individual transactions.
- **Tracked (🔗)** — the spent amount is the live total of the transactions assigned to that line, and the cell becomes read-only.

You don't usually need to think about this: the moment you assign a transaction to a line (by hand or via import), the line switches itself to Tracked. You can always toggle back.

**How it works:** spent values are never stored as a separate number that can drift — they're recomputed from your transaction register every time the page loads. Income lines total *income* transactions; expense lines total *expense* transactions; split transactions contribute exactly their slice.

### Funds (sinking funds)

A **Fund** group (shown in violet) holds savings goals — "Car repairs", "Holidays" — whose money **rolls over from month to month** instead of resetting.

- The **Planned** amount on a fund line is this month's *contribution*. It counts toward Assigned, just like an expense.
- The violet **Available** column is the fund's running balance: every contribution you've ever planned, minus everything you've ever spent from the fund, across all months up to the one you're viewing.
- Spend from a fund the same way you spend from any line — assign a transaction to it (or enter a manual actual). The Available balance falls accordingly.

When you copy a month, fund lines keep their identity, so the balance keeps accumulating.

### Bills and reminders

Any expense line can be marked as a **bill**:

1. Click the **📅** icon on the line and set the day of the month it's due (1–31). The line gains a "📅 *day*" pill and a **Paid** checkbox.
2. Tick **Paid** when you've paid it this month.
3. A summary banner above the groups counts your bills; when you're viewing the *current* month it warns about urgency:
   - **Overdue** (rose, ⚠) — the due day has passed and the bill isn't ticked.
   - **Due soon** (amber) — due within the next 7 days.

Due days recur: copying a month keeps the due day and resets Paid to unticked. For months shorter than the due day (e.g. day 31 in February), the bill is treated as due on the month's last day. Clear the due day to stop treating the line as a bill.

### Organising groups and lines

- **▲ / ▼** arrows in group headers reorder groups; arrows on rows reorder lines within their group.
- Groups always display income first, then expenses, then funds; your custom order applies within each kind.
- Rename a group or line by clicking its name.

## 4. Paychecks

If your income arrives in instalments — two salaries, a salary plus benefits — the **Paychecks** page lets you plan *which deposit funds which lines* for the current month.

1. **Add a paycheck**: a name ("1st paycheck"), the date you expect it, and the amount.
2. Click **Allocate** on the paycheck and add rows: pick a budget line (expense or fund) and an amount. The **left** indicator shows how much of the paycheck is still unallocated (it turns red if you allocate more than the paycheck).
3. Save — the allocations show as chips on the paycheck card, and the card shows what's still **left to assign**.

Paycheck planning is a *planning layer*: it helps you sequence your month ("rent comes out of the 1st paycheck, groceries out of the 15th") but doesn't change the budget's totals or actuals. You can edit a paycheck's details (✎), delete it (✕), or re-open Allocate at any time — saving allocations replaces the previous set.

If the current month has no budget yet, create it on the Budget page first.

## 5. Transactions

The register of real money movements. Everything here can also arrive automatically via [statement import](#7-importing-bank-statements).

### Adding a transaction

Use the **Add a transaction** form: date, payee, amount, type (**Expense** or **Income**), optionally assign it to a budget line right away, and — if you use [Accounts](#6-accounts) — the account it happened on. Amounts accept European decimal commas ("12,50"). Manual entries are recorded in your budget's base currency.

### Assigning to a budget line

Every transaction row has an assignment dropdown grouped by category. Assigning does three things:

1. The line's Spent (or an income line's Received) now includes this transaction.
2. The line switches to transaction tracking, if it wasn't already.
3. ZeroBudget **learns a rule**: next time a statement import sees the same payee, it assigns it automatically (see [Rules](#8-auto-categorization-rules)).

Choose "Unassigned" to detach a transaction again.

### Splitting a transaction

One supermarket receipt, several budget lines? Click **⑂** on the row:

- Add two or more split rows, each with a line and an amount.
- The editor shows the **remainder** live; **Save split** only enables when the rows add up *exactly* to the transaction total.
- Expenses split across expense lines, income across income lines.

A split transaction shows a violet **Split** badge listing its slices, and each slice counts toward its own line. **Remove split** (or re-assigning the whole transaction) undoes it.

### Editing, deleting, finding

- **✎** edits date, payee, amount and type in place; **✕** deletes.
- The search box filters by payee as you type; **Unassigned only** shows just the transactions still needing a home — a quick way to do your weekly tidy-up.

## 6. Accounts

The **Accounts** page tracks *where your money sits* — current account, savings, cash, credit card.

- **Add an account** with a name, a type, a currency, and an **opening balance** (what was in it when you started tracking; credit cards can start negative).
- Each transaction can be tagged with the account it happened on (in the add form, the edit row, or at import time). The account's **current balance** is then always: **opening balance + income − expenses** of its transactions.
- The page totals your balances **per currency**, so a GBP savings pot isn't naively added to your EUR current account.
- Edit (✎) changes name, type and opening balance — the currency is fixed once created, because changing it would silently reinterpret the account's history. Deleting an account keeps its transactions; they just lose the account tag.

**How it works:** like budget actuals, balances are derived from the register at read time — there's no stored balance to drift out of sync. A split transaction still moved in or out of one account, so its *full* amount counts toward that account regardless of how it's split across budget lines.

## 7. Importing bank statements

ZeroBudget imports **CAMT.053** XML statements — the ISO 20022 format most European banks offer for download.

On the Budget page header:

1. (Optional) pick a target in the **account selector** next to the import button — the statement's transactions will be tagged with that account so its balance reflects the statement. Choose "No account" to import untagged.
2. Click **Import statement** and choose the `.xml` file.
3. A summary reports how many entries were imported, skipped and auto-categorized.

What happens during an import:

- **No duplicates, ever.** Each bank entry carries a bank reference; entries you've imported before are skipped. Re-importing the same (or an overlapping) statement is safe.
- **Direction is detected** — credits become income transactions, debits become expenses.
- **Foreign currency is converted**: a transaction in another currency gets an exchange rate into your budget's base currency, so it rolls up into your budget correctly while keeping its original amount.
- **Auto-categorization** runs: payees that match one of your learned [rules](#8-auto-categorization-rules) are assigned to the right budget line automatically. Whatever remains lands as *Unassigned* for you to sort on the Transactions page.

## 8. Auto-categorization rules

Every time you assign a transaction to a budget line, ZeroBudget remembers *payee → category + line*. On the next import, matching payees are assigned automatically. The **Rules** page is where you manage what's been learned:

- The table shows each rule: **when payee matches** · **category** · **line**.
- **✎** lets you re-point a rule at a different category/line. The fields suggest your *actual* category and line names as you type (pick a category and the line suggestions narrow to that category) — rules match lines **by name**, so a typo means the rule silently stops matching. Free text is still allowed.
- **✕** deletes a rule; the next assignment of that payee will learn it afresh.

Rules apply across months: the imported transaction is matched to the line *of that name* in the month the transaction belongs to. If that month has no line with that name, the transaction is left unassigned.

## 9. Reports

The **Reports** page summarises your recent months (up to the last six budgets):

- **Summary cards** — windows totals for **Income (budgeted)**, **Income (received)**, **Spent**, and **Net** (budgeted income − spent).
- **Income vs spending** — three bars per month: budgeted income (light green), actually-received income (dark green), and spending (grey — rose when you spent more than your budgeted income). The +/− figure on each month is income minus spending.
- **Annual overview** — a January-to-December table for any year (◀ / ▶ to change year): income, spent and net per month, with year totals. Months without a budget show as dashes.
- **Spending by category** — a breakdown of where the money went in a chosen month (pick any month from the dropdown), sorted largest first with each category's share. Funds count as spending here; income groups don't.

All report figures use the same derivations as the Budget page — spending comes from your actuals (transactions or manual entries), so the reports always agree with the budget.

## 10. Multi-currency

- Each **budget month** has a base currency (EUR by default). All planned amounts and totals are in this currency.
- **Imported transactions** keep their original currency and amount; an exchange rate converts them into the base currency for everything budget-related. The Transactions page shows the original amount.
- **Accounts** each have their own currency; balances and totals stay per-currency.
- Money is stored and computed exactly (no floating-point) — amounts you see are always to-the-cent accurate, and amounts you type accept both "12.50" and "12,50".

## 11. Feature flags (for self-hosters)

Everything beyond the classic budgeting core can be switched off, turning ZeroBudget into a "pure budgeting" app. In the API's `appsettings.json`:

```json
"Features": {
  "Accounts": true,
  "MultiCurrency": true,
  "CamtImport": true,
  "Reports": true
}
```

| Flag | When off |
|---|---|
| `Accounts` | The Accounts page, nav link and all account pickers disappear; account endpoints return 404. |
| `MultiCurrency` | The currency field is hidden where it appears (new accounts default to EUR). |
| `CamtImport` | The import button and account selector disappear; the import endpoint returns 404. |
| `Reports` | The Reports page and nav link disappear; report endpoints return 404. |

All flags default to **on**. A disabled feature is enforced server-side too — its API stops responding, not just its buttons. Restart the API after changing flags.

## 12. Everyday tips

- **A sensible monthly rhythm:** create the month by copying the previous one → adjust planned amounts until the banner is green → set up your paychecks → during the month, import statements weekly and clear the *Unassigned only* list → tick bills as you pay them → glance at Reports at month-end.
- **Inline editing everywhere:** click a value, type, press **Enter** (or click away) to save, **Escape** to cancel. A small pulsing dot means a save is in flight; failed saves roll back and show an error.
- **Don't fear deletes:** deleting budget lines, accounts or rules never deletes transactions — they just become unassigned/untagged.
- **The banner won't balance?** Remember funds count as assignments. If you're over-budgeted, trimming a fund contribution is often the easiest fix.
- **A line's Spent cell is read-only?** It's in transaction-tracking mode (🔗). That's by design — its value is the sum of its transactions. Toggle to ✎ if you'd rather type a number.
