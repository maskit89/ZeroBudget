using MediatR;
using ZeroBudget.Application.Budgets.Dtos;

namespace ZeroBudget.Application.Budgets.Commands.SetBudgetItemActual;

/// <summary>
/// Sets a line's manually-entered spent amount, for users who track actuals by
/// hand rather than via transactions/import. Has no visible effect while the
/// line has assigned transactions (those drive the displayed actual), but is
/// retained as the fallback. Returns the recomputed month.
/// </summary>
public record SetBudgetItemActualCommand(
    Guid BudgetItemId,
    decimal ActualAmount) : IRequest<BudgetMonthDto>;
