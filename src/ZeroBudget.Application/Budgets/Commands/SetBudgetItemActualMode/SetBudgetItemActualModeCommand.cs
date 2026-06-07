using MediatR;
using ZeroBudget.Application.Budgets.Dtos;

namespace ZeroBudget.Application.Budgets.Commands.SetBudgetItemActualMode;

/// <summary>
/// Switches how a line's spent amount is determined: track it from assigned
/// transactions (<paramref name="TrackByTransactions"/> = true) or type it in
/// manually (false). Returns the recomputed month.
/// </summary>
public record SetBudgetItemActualModeCommand(
    Guid BudgetItemId,
    bool TrackByTransactions) : IRequest<BudgetMonthDto>;
