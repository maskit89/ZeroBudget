using MediatR;
using ZeroBudget.Application.Budgets.Dtos;

namespace ZeroBudget.Application.Budgets.Commands.AddBudgetCategory;

/// <summary>
/// Creates a new high-level expense group (e.g. "Housing", "Subscriptions") in a
/// month. Income groups are not created this way — a budget has the single
/// Income group seeded with it. Returns the recomputed month.
/// </summary>
public record AddBudgetCategoryCommand(
    Guid BudgetMonthId,
    string Name) : IRequest<BudgetMonthDto>;
