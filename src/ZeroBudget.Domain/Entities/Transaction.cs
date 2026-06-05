using ZeroBudget.Domain.Common;
using ZeroBudget.Domain.Enums;
using ZeroBudget.Domain.ValueObjects;

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

    /// <summary>Amount in the transaction's own <see cref="Currency"/>. Positive magnitude; direction is on <see cref="Type"/>.</summary>
    public decimal Amount { get; set; }

    /// <summary>The currency the transaction actually happened in (e.g. GBP abroad).</summary>
    public CurrencyCode Currency { get; set; } = CurrencyCode.Eur;

    /// <summary>
    /// Multiplier converting <see cref="Amount"/> into the budget's base currency.
    /// 1 when the transaction is already in the base currency. decimal(18,6).
    /// </summary>
    public decimal ExchangeRate { get; set; } = 1m;

    /// <summary>The amount expressed in the budget's base currency (<see cref="Amount"/> × <see cref="ExchangeRate"/>).</summary>
    public decimal BaseAmount => Amount * ExchangeRate;

    public TransactionType Type { get; set; } = TransactionType.Expense;

    public DateOnly Date { get; set; }

    public string Payee { get; set; } = string.Empty;

    public string? Notes { get; set; }
}
