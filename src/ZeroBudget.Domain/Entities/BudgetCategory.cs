using ZeroBudget.Domain.Common;

namespace ZeroBudget.Domain.Entities;

/// <summary>
/// A grouping of budget lines (e.g. "Housing", "Transport") within a single month.
/// </summary>
public class BudgetCategory : BaseEntity
{
    public Guid BudgetMonthId { get; set; }
    public BudgetMonth BudgetMonth { get; set; } = null!;

    public string Name { get; set; } = string.Empty;

    public int DisplayOrder { get; set; }

    public ICollection<BudgetItem> Items { get; set; } = new List<BudgetItem>();

    /// <summary>Sum of all planned amounts for the lines in this category.</summary>
    public decimal TotalPlanned => Items.Sum(i => i.PlannedAmount);

    /// <summary>Sum of all actual amounts for the lines in this category.</summary>
    public decimal TotalActual => Items.Sum(i => i.ActualAmount);
}
