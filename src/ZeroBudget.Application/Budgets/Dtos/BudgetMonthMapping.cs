using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Application.Budgets.Dtos;

/// <summary>
/// Hand-written projection from the domain aggregate to the API DTOs.
/// Kept explicit (rather than reflection-based mapping) so the computed
/// ZBB metrics are evaluated once, server-side, and shipped to the client.
/// </summary>
public static class BudgetMonthMapping
{
    public static BudgetMonthDto ToDto(this BudgetMonth month) => new()
    {
        Id = month.Id,
        Key = month.Key,
        Year = month.Year,
        Month = month.Month,
        BaseCurrency = month.BaseCurrency.Value,
        TotalIncome = month.TotalIncome,
        TotalPlanned = month.TotalPlanned,
        RemainingToBudget = month.RemainingToBudget,
        IsBalanced = month.IsBalanced,
        Categories = month.Categories
            // Income groups always render first (like EveryDollar), then by the
            // user's chosen display order within each kind.
            .OrderBy(c => c.Kind == CategoryKind.Income ? 0 : 1)
            .ThenBy(c => c.DisplayOrder)
            .Select(c => new BudgetCategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Kind = c.Kind.ToString(),
                DisplayOrder = c.DisplayOrder,
                TotalPlanned = c.TotalPlanned,
                TotalActual = c.TotalActual,
                Items = c.Items
                    .OrderBy(i => i.DisplayOrder)
                    .Select(i => new BudgetItemDto
                    {
                        Id = i.Id,
                        Name = i.Name,
                        DisplayOrder = i.DisplayOrder,
                        PlannedAmount = i.PlannedAmount,
                        ActualAmount = i.ActualAmount,
                        Remaining = i.Remaining
                    })
                    .ToList()
            })
            .ToList()
    };
}
