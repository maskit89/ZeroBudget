namespace ZeroBudget.Application.Budgets.Dtos;

public class BudgetMonthDto
{
    public Guid Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public int Year { get; set; }
    public int Month { get; set; }

    /// <summary>ISO 4217 code the whole budget is planned in (e.g. "EUR").</summary>
    public string BaseCurrency { get; set; } = "EUR";

    public decimal TotalIncome { get; set; }
    public decimal TotalPlanned { get; set; }

    /// <summary>Total income minus every planned amount. The banner drives this to €0.00.</summary>
    public decimal RemainingToBudget { get; set; }
    public bool IsBalanced { get; set; }

    public List<BudgetCategoryDto> Categories { get; set; } = new();
}

public class BudgetCategoryDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public decimal TotalPlanned { get; set; }
    public decimal TotalActual { get; set; }
    public List<BudgetItemDto> Items { get; set; } = new();
}

public class BudgetItemDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public decimal PlannedAmount { get; set; }
    public decimal ActualAmount { get; set; }
    public decimal Remaining { get; set; }
}
