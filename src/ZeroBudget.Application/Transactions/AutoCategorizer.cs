using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Application.Transactions;

/// <summary>
/// A lightweight, behind-the-scenes categorizer. When a transaction is logged
/// without a budget line, it inherits the line of the user's most recent earlier
/// transaction with the same description (payee). This is a zero-configuration
/// default — there are no user-managed rules — and applies both to manually-added
/// transactions and to any future statement import. Returns how many of the given
/// candidates were assigned.
/// </summary>
public static partial class AutoCategorizer
{
    public static async Task<int> ApplyAsync(
        IApplicationDbContext db,
        string ownerId,
        IReadOnlyList<Transaction> transactions,
        CancellationToken cancellationToken)
    {
        // Only unassigned transactions with a usable description are candidates.
        var candidates = transactions
            .Where(t => t.BudgetItemId is null && NormalizeDescription(t.Payee).Length > 0)
            .ToList();
        if (candidates.Count == 0)
        {
            return 0;
        }

        // Never let a candidate match against itself (the import batch isn't saved
        // yet, but be defensive).
        var candidateIds = candidates.Select(t => t.Id).ToHashSet();

        // Load this user's already-categorized transactions, most recent first, and
        // index them by normalized description → the line they were assigned to. We
        // normalize in memory so the match is case- and whitespace-insensitive.
        var prior = await db.Transactions
            .AsNoTracking()
            .Where(t => t.OwnerId == ownerId
                        && t.BudgetItemId != null
                        && !candidateIds.Contains(t.Id))
            .OrderByDescending(t => t.Date)
            .ThenByDescending(t => t.Id)
            .Select(t => new { t.Payee, t.BudgetItemId })
            .ToListAsync(cancellationToken);

        var lineByDescription = new Dictionary<string, Guid>();
        foreach (var p in prior)
        {
            var key = NormalizeDescription(p.Payee);
            // First write wins — the list is ordered most-recent-first.
            if (key.Length > 0 && !lineByDescription.ContainsKey(key))
            {
                lineByDescription[key] = p.BudgetItemId!.Value;
            }
        }
        if (lineByDescription.Count == 0)
        {
            return 0;
        }

        var assigned = 0;
        var touchedItemIds = new HashSet<Guid>();
        foreach (var tx in candidates)
        {
            if (lineByDescription.TryGetValue(NormalizeDescription(tx.Payee), out var itemId))
            {
                tx.BudgetItemId = itemId;
                touchedItemIds.Add(itemId);
                assigned++;
            }
        }

        // A line that now has a transaction on it is tracked by its transactions.
        if (touchedItemIds.Count > 0)
        {
            var items = await db.BudgetItems
                .Where(i => touchedItemIds.Contains(i.Id))
                .ToListAsync(cancellationToken);
            foreach (var item in items)
            {
                item.ActualEntryMode = ActualEntryMode.Tracked;
            }
        }

        return assigned;
    }

    /// <summary>
    /// Normalize a description into a stable match key: trimmed, lower-cased, with
    /// internal whitespace collapsed. Returns "" for blank input.
    /// </summary>
    private static string NormalizeDescription(string? description)
    {
        if (string.IsNullOrWhiteSpace(description))
        {
            return string.Empty;
        }
        return WhitespacePattern().Replace(description.Trim().ToLowerInvariant(), " ");
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespacePattern();
}
