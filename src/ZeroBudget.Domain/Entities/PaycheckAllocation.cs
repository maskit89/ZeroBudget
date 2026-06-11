using ZeroBudget.Domain.Common;

namespace ZeroBudget.Domain.Entities;

/// <summary>
/// A portion of a <see cref="Paycheck"/> earmarked to fund a single budget line —
/// "this paycheck covers €X of Rent". A budget line can be funded by several
/// paychecks; a paycheck can fund several lines.
/// </summary>
public class PaycheckAllocation : BaseEntity
{
    public Guid PaycheckId { get; set; }
    public Paycheck Paycheck { get; set; } = null!;

    /// <summary>
    /// The budget line this portion funds. Nullable so deleting a line leaves the
    /// allocation orphaned rather than blocking the delete (mirrors transaction
    /// splits); orphaned allocations are ignored when reading.
    /// </summary>
    public Guid? BudgetItemId { get; set; }
    public BudgetItem? BudgetItem { get; set; }

    /// <summary>The amount of the paycheck assigned to the line (positive), in base currency.</summary>
    public decimal Amount { get; set; }
}
