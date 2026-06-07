using ZeroBudget.Domain.Common;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Domain.Entities;

/// <summary>
/// A grouping of budget lines within a single month. Most groups are expenses
/// (e.g. "Housing", "Transport"); an <see cref="CategoryKind.Income"/> group sits
/// at the top and holds the user's income sources.
/// </summary>
public class BudgetCategory : BaseEntity
{
    public Guid BudgetMonthId { get; set; }
    public BudgetMonth BudgetMonth { get; set; } = null!;

    public string Name { get; set; } = string.Empty;

    /// <summary>Whether this group holds income sources or planned expenses.</summary>
    public CategoryKind Kind { get; set; } = CategoryKind.Expense;

    public int DisplayOrder { get; set; }

    public ICollection<BudgetItem> Items { get; set; } = new List<BudgetItem>();

    /// <summary>Sum of all planned amounts for the lines in this category.</summary>
    public decimal TotalPlanned => Items.Sum(i => i.PlannedAmount);

    /// <summary>Sum of all actual amounts for the lines in this category.</summary>
    public decimal TotalActual => Items.Sum(i => i.ActualAmount);
}
