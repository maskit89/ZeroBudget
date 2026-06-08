using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Application.Budgets;

/// <summary>
/// Derives each budget line's <see cref="BudgetItem.ActualAmount"/> from its
/// chosen <see cref="BudgetItem.ActualEntryMode"/>:
///   Tracked — the sum of the assigned transactions of the line's own kind
///             (income lines roll up income transactions, expense lines roll up
///             expense transactions), in the budget's base currency via
///             Amount × ExchangeRate;
///   Manual  — the user's <see cref="BudgetItem.ManualActualAmount"/>.
/// So an income line's "received" and an expense line's "spent" both work the
/// same way. Computing at read time keeps a single, deterministic source of truth.
/// </summary>
public static class BudgetActuals
{
    public static async Task ApplyAsync(
        IApplicationDbContext db,
        string ownerId,
        BudgetMonth month,
        CancellationToken cancellationToken)
    {
        var items = month.Categories.SelectMany(c => c.Items).ToList();
        if (items.Count == 0)
        {
            return;
        }

        // Income lines roll up income transactions; expense lines roll up expense
        // transactions. Track which ids are income so each line matches its kind.
        var incomeItemIds = month.Categories
            .Where(c => c.Kind == CategoryKind.Income)
            .SelectMany(c => c.Items)
            .Select(i => i.Id)
            .ToHashSet();

        var itemIds = items.Select(i => i.Id).ToList();

        // Whole (non-split) transactions assigned directly to a line.
        var sums = await db.Transactions
            .Where(t => t.OwnerId == ownerId
                        && t.BudgetItemId != null
                        && itemIds.Contains(t.BudgetItemId.Value))
            .GroupBy(t => new { ItemId = t.BudgetItemId!.Value, t.Type })
            .Select(g => new { g.Key.ItemId, g.Key.Type, Total = g.Sum(t => t.Amount * t.ExchangeRate) })
            .ToListAsync(cancellationToken);

        // Slices of split transactions. A split transaction has BudgetItemId == null
        // so it never appears above — no double counting. Each slice rolls up at the
        // parent's exchange rate and inherits the parent's direction (Type).
        var splitRows = await (
            from s in db.TransactionSplits
            join t in db.Transactions on s.TransactionId equals t.Id
            where t.OwnerId == ownerId
                  && s.BudgetItemId != null
                  && itemIds.Contains(s.BudgetItemId.Value)
            select new { ItemId = s.BudgetItemId!.Value, t.Type, Total = s.Amount * t.ExchangeRate })
            .ToListAsync(cancellationToken);

        var splitSums = splitRows
            .GroupBy(s => new { s.ItemId, s.Type })
            .ToDictionary(g => (g.Key.ItemId, g.Key.Type), g => g.Sum(s => s.Total));

        foreach (var item in items)
        {
            if (item.ActualEntryMode == ActualEntryMode.Tracked)
            {
                var wantType = incomeItemIds.Contains(item.Id)
                    ? TransactionType.Income
                    : TransactionType.Expense;
                var whole = sums
                    .Where(s => s.ItemId == item.Id && s.Type == wantType)
                    .Sum(s => s.Total);
                var fromSplits = splitSums.TryGetValue((item.Id, wantType), out var v) ? v : 0m;
                item.ActualAmount = whole + fromSplits;
                item.IsActualTracked = true;
            }
            else
            {
                item.ActualAmount = item.ManualActualAmount;
                item.IsActualTracked = false;
            }
        }
    }
}
