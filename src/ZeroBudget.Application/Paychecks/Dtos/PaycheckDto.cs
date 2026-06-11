using ZeroBudget.Domain.Entities;

namespace ZeroBudget.Application.Paychecks.Dtos;

public class PaycheckDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateOnly Date { get; set; }
    public decimal PlannedAmount { get; set; }

    /// <summary>Σ of the paycheck's allocations.</summary>
    public decimal AllocatedAmount { get; set; }

    /// <summary>Planned − allocated: what's left of the paycheck to assign.</summary>
    public decimal Remaining { get; set; }

    public int DisplayOrder { get; set; }

    public List<PaycheckAllocationDto> Allocations { get; set; } = new();
}

public class PaycheckAllocationDto
{
    public Guid Id { get; set; }
    public Guid? BudgetItemId { get; set; }
    public string? BudgetItemName { get; set; }
    public decimal Amount { get; set; }
}

public static class PaycheckMapping
{
    public static PaycheckDto ToDto(this Paycheck p) => new()
    {
        Id = p.Id,
        Name = p.Name,
        Date = p.Date,
        PlannedAmount = p.PlannedAmount,
        AllocatedAmount = p.AllocatedAmount,
        Remaining = p.Remaining,
        DisplayOrder = p.DisplayOrder,
        Allocations = p.Allocations
            // Orphaned allocations (line deleted) are filtered out — they no longer fund anything.
            .Where(a => a.BudgetItemId != null)
            .OrderBy(a => a.Id)
            .Select(a => new PaycheckAllocationDto
            {
                Id = a.Id,
                BudgetItemId = a.BudgetItemId,
                BudgetItemName = a.BudgetItem?.Name,
                Amount = a.Amount,
            })
            .ToList(),
    };
}
