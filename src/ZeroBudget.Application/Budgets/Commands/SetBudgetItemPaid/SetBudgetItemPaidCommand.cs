using MediatR;
using ZeroBudget.Application.Budgets.Dtos;
using ZeroBudget.Application.Common.Security;

namespace ZeroBudget.Application.Budgets.Commands.SetBudgetItemPaid;

/// <summary>
/// Marks this month's instance of a bill line as paid (or unpaid). Returns the
/// recomputed month.
/// </summary>
[AllowLimited]
public record SetBudgetItemPaidCommand(
    Guid BudgetItemId,
    bool IsPaid) : IRequest<BudgetMonthDto>;
