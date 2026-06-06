using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Domain.Entities;

namespace ZeroBudget.Application.Transactions;

/// <summary>
/// Applies a user's learned categorization rules to a batch of (unassigned)
/// transactions: a transaction whose payee matches a rule is assigned to the
/// budget line of the rule's category/item name <em>in that transaction's month</em>
/// (when such a line exists). Returns how many were assigned.
/// </summary>
public static class AutoCategorizer
{
    public static async Task<int> ApplyAsync(
        IApplicationDbContext db,
        string ownerId,
        IReadOnlyList<Transaction> transactions,
        CancellationToken cancellationToken)
    {
        var candidates = transactions.Where(t => t.BudgetItemId is null).ToList();
        if (candidates.Count == 0)
        {
            return 0;
        }

        var keys = candidates
            .Select(t => CategorizationRule.NormalizeKey(t.Payee))
            .Where(k => k.Length > 0)
            .Distinct()
            .ToList();
        if (keys.Count == 0)
        {
            return 0;
        }

        var rules = await db.CategorizationRules
            .Where(r => r.OwnerId == ownerId && keys.Contains(r.PayeeKey))
            .ToDictionaryAsync(r => r.PayeeKey, cancellationToken);
        if (rules.Count == 0)
        {
            return 0;
        }

        // Load the months these transactions fall in, with their lines.
        var years = candidates.Select(t => t.Date.Year).Distinct().ToList();
        var months = await db.BudgetMonths
            .Where(m => m.OwnerId == ownerId && years.Contains(m.Year))
            .Include(m => m.Categories)
                .ThenInclude(c => c.Items)
            .ToListAsync(cancellationToken);

        // (year, month, categoryName, itemName) -> item id
        var itemLookup = new Dictionary<(int, int, string, string), Guid>();
        foreach (var month in months)
        {
            foreach (var category in month.Categories)
            {
                foreach (var item in category.Items)
                {
                    var key = (month.Year, month.Month,
                        category.Name.ToLowerInvariant(), item.Name.ToLowerInvariant());
                    itemLookup[key] = item.Id;
                }
            }
        }

        var assigned = 0;
        foreach (var tx in candidates)
        {
            var payeeKey = CategorizationRule.NormalizeKey(tx.Payee);
            if (payeeKey.Length == 0 || !rules.TryGetValue(payeeKey, out var rule))
            {
                continue;
            }

            var lookupKey = (tx.Date.Year, tx.Date.Month,
                rule.CategoryName.ToLowerInvariant(), rule.ItemName.ToLowerInvariant());
            if (itemLookup.TryGetValue(lookupKey, out var itemId))
            {
                tx.BudgetItemId = itemId;
                assigned++;
            }
        }

        return assigned;
    }
}
