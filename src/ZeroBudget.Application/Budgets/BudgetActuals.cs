using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Application.Budgets;

/// <summary>
/// Derives each budget line's <see cref="BudgetItem.ActualAmount"/> from the
/// expense transactions assigned to it (summed in the budget's base currency via
/// Amount × ExchangeRate). Computing actuals at read time keeps a single source
/// of truth — there is no denormalized total to keep in sync.
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
            item.ActualAmount = actualByItem.TryGetValue(item.Id, out var total) ? total : 0m;
        }
    }
}
