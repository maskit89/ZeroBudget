using ZeroBudget.Domain.Common;

namespace ZeroBudget.Domain.Entities;

/// <summary>
/// One slice of a split transaction: a portion of the parent
/// <see cref="Transaction"/>'s amount attributed to a single budget line.
/// A transaction is "split" when it has two or more of these, and their
/// amounts sum to the transaction's total. Amounts are in the parent
/// transaction's own currency — the parent's
/// <see cref="Transaction.ExchangeRate"/> converts each slice into the budget
/// base currency for the actuals roll-up.
/// </summary>
public class TransactionSplit : BaseEntity
{
    public Guid TransactionId { get; set; }
    public Transaction Transaction { get; set; } = null!;

    /// <summary>
    /// The budget line this slice is attributed to. Nullable so deleting a line
    /// leaves an "unassigned" slice rather than blocking the delete (mirrors how a
    /// whole transaction becomes unassigned when its line is removed).
    /// </summary>
    public Guid? BudgetItemId { get; set; }
    public BudgetItem? BudgetItem { get; set; }

    /// <summary>Portion of the parent's amount — a positive magnitude, in the parent's currency.</summary>
    public decimal Amount { get; set; }
}
