using MediatR;
using ZeroBudget.Application.Budgets.Dtos;

namespace ZeroBudget.Application.Budgets.Commands.ReorderBudgetItems;

/// <summary>
/// Sets the display order of the lines within a category to match the given id
/// order. Returns the recomputed month.
/// </summary>
public record ReorderBudgetItemsCommand(
    Guid CategoryId,
    IReadOnlyList<Guid> OrderedItemIds) : IRequest<BudgetMonthDto>;
