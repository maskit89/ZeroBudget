using MediatR;

namespace ZeroBudget.Application.Budgets.Queries.GetBudgetLineOptions;

/// <summary>
/// Lists the distinct category and line names that exist across the user's budgets,
/// grouped by category. Used to suggest valid targets when editing a categorization
/// rule (a rule matches a line by name, so typos silently stop it matching).
/// </summary>
public record GetBudgetLineOptionsQuery : IRequest<IReadOnlyList<BudgetLineOptionDto>>;

/// <summary>One category and the distinct line names seen under it.</summary>
public class BudgetLineOptionDto
{
    public string CategoryName { get; set; } = string.Empty;
    public List<string> ItemNames { get; set; } = new();
}
