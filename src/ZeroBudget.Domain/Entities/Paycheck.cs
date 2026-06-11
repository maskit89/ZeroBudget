using ZeroBudget.Domain.Common;

namespace ZeroBudget.Domain.Entities;

/// <summary>
/// An expected pay deposit within a budget month. Paycheck planning lets the user
/// decide which paycheck funds which budget lines — useful when income arrives in
/// several instalments across the month. A paycheck's <see cref="PlannedAmount"/> is
/// spread across budget lines via its <see cref="Allocations"/>; what's left over is
/// the amount still to assign. This is a planning layer over the budget; it doesn't
/// change the zero-based totals.
/// </summary>
public class Paycheck : BaseEntity
{
    /// <summary>Identity user id that owns this paycheck (denormalised for fast, secure filtering).</summary>
    public string OwnerId { get; set; } = string.Empty;

    /// <summary>The budget month this paycheck belongs to.</summary>
    public Guid BudgetMonthId { get; set; }
    public BudgetMonth BudgetMonth { get; set; } = null!;

    public string Name { get; set; } = string.Empty;

    public DateOnly Date { get; set; }

    /// <summary>The expected amount of this paycheck, in the budget's base currency.</summary>
    public decimal PlannedAmount { get; set; }

    public int DisplayOrder { get; set; }

    /// <summary>How this paycheck's amount is spread across budget lines.</summary>
    public ICollection<PaycheckAllocation> Allocations { get; set; } = new List<PaycheckAllocation>();

    /// <summary>The total assigned to budget lines (Σ allocations).</summary>
    public decimal AllocatedAmount => Allocations.Sum(a => a.Amount);

    /// <summary>What's left of the paycheck to assign (planned − allocated).</summary>
    public decimal Remaining => PlannedAmount - AllocatedAmount;
}
