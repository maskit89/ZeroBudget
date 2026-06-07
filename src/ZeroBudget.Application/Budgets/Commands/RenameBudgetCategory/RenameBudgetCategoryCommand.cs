using MediatR;
using ZeroBudget.Application.Budgets.Dtos;

namespace ZeroBudget.Application.Budgets.Commands.RenameBudgetCategory;

/// <summary>Renames a category group. Returns the recomputed month.</summary>
public record RenameBudgetCategoryCommand(
    Guid CategoryId,
    string Name) : IRequest<BudgetMonthDto>;
