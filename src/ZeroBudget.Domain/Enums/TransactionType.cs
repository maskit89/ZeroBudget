namespace ZeroBudget.Domain.Enums;

/// <summary>
/// Direction of money movement for a <see cref="Entities.Transaction"/>.
/// </summary>
public enum TransactionType
{
    Expense = 0,
    Income = 1
}
