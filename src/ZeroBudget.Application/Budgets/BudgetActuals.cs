using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Application.Budgets;

/// <summary>
/// Derives each budget line's <see cref="BudgetItem.ActualAmount"/> from its
/// chosen <see cref="BudgetItem.ActualEntryMode"/>:
///   Tracked — the sum of the assigned expense transactions (in the budget's base
///             currency via Amount × ExchangeRate);
///   Manual  — the user's <see cref="BudgetItem.ManualActualAmount"/>.
/// This lets each line independently be hand-tracked or transaction-tracked.
/// Computing at read time keeps a single, deterministic source of truth per line.
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

        var itemIds = items.Select(i => i.Id).ToList();

        var actualByItem = await db.Transactions
            .Where(t => t.OwnerId == ownerId
                        && t.BudgetItemId != null
                        && itemIds.Contains(t.BudgetItemId.Value)
                        && t.Type == TransactionType.Expense)
            .GroupBy(t => t.BudgetItemId!.Value)
            .Select(g => new { ItemId = g.Key, Total = g.Sum(t => t.Amount * t.ExchangeRate) })
            .ToDictionaryAsync(x => x.ItemId, x => x.Total, cancellationToken);

        foreach (var item in items)
        {
            if (item.ActualEntryMode == ActualEntryMode.Tracked)
            {
                item.ActualAmount = actualByItem.TryGetValue(item.Id, out var total) ? total : 0m;
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
