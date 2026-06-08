using MediatR;
using ZeroBudget.Application.Budgets.Dtos;

namespace ZeroBudget.Application.Budgets.Queries.GetBudgetTemplates;

/// <summary>Lists the built-in quick-start budget templates.</summary>
public record GetBudgetTemplatesQuery : IRequest<IReadOnlyList<BudgetTemplateDto>>;
