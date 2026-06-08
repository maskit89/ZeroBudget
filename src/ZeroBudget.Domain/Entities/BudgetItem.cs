using ZeroBudget.Domain.Common;
using ZeroBudget.Domain.Enums;

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
    /// The user's chosen way of determining this line's spent amount — type it in
    /// (<see cref="ActualEntryMode.Manual"/>) or roll it up from assigned
    /// transactions (<see cref="ActualEntryMode.Tracked"/>). New lines default to
    /// Manual so people who don't track transactions can just type a value.
    /// </summary>
    public ActualEntryMode ActualEntryMode { get; set; } = ActualEntryMode.Manual;

    /// <summary>
    /// Transient (not persisted): true when <see cref="ActualAmount"/> is being
    /// driven by transactions rather than the manual value (i.e. mode is Tracked).
    /// Lets the UI show the spent cell as read-only vs editable.
    /// </summary>
    public bool IsActualTracked { get; set; }

    /// <summary>
    /// For a line in a <see cref="CategoryKind.Fund"/> group: a stable id shared by
    /// every month's instance of the same sinking fund, so its balance can roll over.
    /// Generated when the fund line is first created and preserved when a month is
    /// copied. Null for ordinary income/expense lines.
    /// </summary>
    public Guid? FundId { get; set; }

    /// <summary>
    /// Transient (not persisted): for a fund line, the running available balance of
    /// the fund as of this month — the sum of every contribution (planned) minus
    /// every spend (actual) across all months up to and including this one. Null for
    /// non-fund lines. Derived at read time (see
    /// ZeroBudget.Application.Budgets.BudgetActuals).
    /// </summary>
    public decimal? FundAvailable { get; set; }

    /// <summary>
    /// The day of the month (1–31) this line is due, when it is tracked as a bill.
    /// Null for lines that aren't bills. Recurs month to month (copied when a month
    /// is created); the matching <see cref="IsPaid"/> resets each month.
    /// </summary>
    public int? DueDay { get; set; }

    /// <summary>
    /// Whether this month's instance of the bill has been paid. Only meaningful when
    /// <see cref="DueDay"/> is set. Resets to false when a new month is created.
    /// </summary>
    public bool IsPaid { get; set; }

    /// <summary>True when this line is tracked as a bill (it has a due day).</summary>
    public bool IsBill => DueDay is not null;

    public int DisplayOrder { get; set; }

    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();

    /// <summary>
    /// Positive when there is budget left on the line, negative when overspent.
    /// </summary>
    public decimal Remaining => PlannedAmount - ActualAmount;
}
