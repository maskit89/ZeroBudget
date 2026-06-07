using ZeroBudget.Domain.Common;

namespace ZeroBudget.Domain.Entities;

/// <summary>
/// A single budget line (e.g. "Rent", "Groceries") that belongs to a category.
/// Currency amounts are stored as <see cref="decimal"/> and mapped to
/// SQL Server decimal(18,4) so no precision is lost on Euro cents.
/// </summary>
public class BudgetItem : BaseEntity
{
    public Guid BudgetCategoryId { get; set; }
    public BudgetCategory BudgetCategory { get; set; } = null!;

    public string Name { get; set; } = string.Empty;

    /// <summary>The amount the user has assigned/planned for this line this month.</summary>
    public decimal PlannedAmount { get; set; }

    /// <summary>
    /// The displayed amount spent so far. Derived at read time (see
    /// ZeroBudget.Application.Budgets.BudgetActuals): the sum of the line's
    /// assigned expense transactions when it has any, otherwise the user's
    /// <see cref="ManualActualAmount"/>. Not authored directly.
    /// </summary>
    public decimal ActualAmount { get; set; }

    /// <summary>
    /// The amount the user typed in manually for this line. Used as the spent
    /// value when the line has no transactions to roll up — so people who don't
    /// import or log individual transactions can still track actuals. Mapped to
    /// decimal(18,4).
    /// </summary>
    public decimal ManualActualAmount { get; set; }

    /// <summary>
    /// Transient (not persisted): true when <see cref="ActualAmount"/> is being
    /// driven by transactions rather than the manual value. Lets the UI show the
    /// spent cell as read-only (transaction-tracked) vs editable (manual).
    /// </summary>
    public bool IsActualTracked { get; set; }

    public int DisplayOrder { get; set; }

    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();

    /// <summary>
    /// Positive when there is budget left on the line, negative when overspent.
    /// </summary>
    public decimal Remaining => PlannedAmount - ActualAmount;
}
