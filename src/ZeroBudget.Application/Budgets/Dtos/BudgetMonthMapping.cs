using ZeroBudget.Domain.Entities;

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
        TotalIncome = month.TotalIncome,
        TotalPlanned = month.TotalPlanned,
        RemainingToBudget = month.RemainingToBudget,
        IsBalanced = month.IsBalanced,
        Categories = month.Categories
            .OrderBy(c => c.DisplayOrder)
            .Select(c => new BudgetCategoryDto
            {
                Id = c.Id,
                Name = c.Name,
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
