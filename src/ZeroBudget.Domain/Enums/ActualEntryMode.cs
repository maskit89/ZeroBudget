namespace ZeroBudget.Domain.Enums;

/// <summary>
/// How a budget line's spent ("actual") amount is determined — the user's
/// explicit choice per line.
///   <see cref="Manual"/>  — the user types the spent value directly.
///   <see cref="Tracked"/> — the spent value is the sum of the transactions
///                           assigned to the line (entered in the sheet or imported).
/// </summary>
public enum ActualEntryMode
{
    Manual = 0,
    Tracked = 1
}
