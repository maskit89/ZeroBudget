namespace ZeroBudget.Domain.Enums;

/// <summary>
/// Distinguishes an income group (whose lines are sources of money, e.g.
/// "Take-home Pay", "Freelance", "Child Benefit") from a regular expense group.
///
/// In zero-based budgeting the pool to allocate is the sum of the income lines,
/// and every Euro of it must be assigned to an expense line until
/// <see cref="Entities.BudgetMonth.RemainingToBudget"/> reaches 0.
/// The numeric values mirror <see cref="TransactionType"/> for consistency.
/// </summary>
public enum CategoryKind
{
    Expense = 0,
    Income = 1
}
