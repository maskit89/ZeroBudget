using ZeroBudget.Domain.Common;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Domain.Entities;

/// <summary>
/// A real money movement. Expenses are typically linked to the budget line
/// they were spent against; income transactions may stand alone.
/// </summary>
public class Transaction : BaseEntity
{
    /// <summary>Identity user id that owns this transaction (denormalised for fast, secure filtering).</summary>
    public string OwnerId { get; set; } = string.Empty;

    /// <summary>The budget line this transaction is attributed to (optional for raw income).</summary>
    public Guid? BudgetItemId { get; set; }
    public BudgetItem? BudgetItem { get; set; }

    /// <summary>Amount in Euro. Always stored as a positive magnitude; direction is on <see cref="Type"/>.</summary>
    public decimal Amount { get; set; }

    public TransactionType Type { get; set; } = TransactionType.Expense;

    public DateOnly Date { get; set; }

    public string Payee { get; set; } = string.Empty;

    public string? Notes { get; set; }
}
