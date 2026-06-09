using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Application.Accounts;

/// <summary>
/// Derives each account's <see cref="Account.CurrentBalance"/> at read time:
/// the <see cref="Account.OpeningBalance"/> plus the net of every transaction
/// assigned to it (income adds, expense subtracts), in the account's own currency.
/// The transaction register therefore stays the single source of truth — there is no
/// stored balance to drift. Splitting a transaction doesn't change which account the
/// money moved in, so the whole transaction amount counts (slices are budget-line
/// attribution only).
/// </summary>
public static class AccountBalances
{
    public static async Task ApplyAsync(
        IApplicationDbContext db,
        string ownerId,
        IReadOnlyList<Account> accounts,
        CancellationToken cancellationToken)
    {
        if (accounts.Count == 0)
        {
            return;
        }

        var accountIds = accounts.Select(a => a.Id).ToList();

        // Net movement per account: + income, − expense, at the transaction's amount.
        var nets = (await db.Transactions
            .Where(t => t.OwnerId == ownerId
                        && t.AccountId != null
                        && accountIds.Contains(t.AccountId.Value))
            .GroupBy(t => new { AccountId = t.AccountId!.Value, t.Type })
            .Select(g => new { g.Key.AccountId, g.Key.Type, Total = g.Sum(t => t.Amount) })
            .ToListAsync(cancellationToken))
            .ToList();

        foreach (var account in accounts)
        {
            var income = nets
                .Where(n => n.AccountId == account.Id && n.Type == TransactionType.Income)
                .Sum(n => n.Total);
            var expense = nets
                .Where(n => n.AccountId == account.Id && n.Type == TransactionType.Expense)
                .Sum(n => n.Total);

            account.CurrentBalance = account.OpeningBalance + income - expense;
        }
    }
}
