namespace ZeroBudget.Application.Reports.Dtos;

/// <summary>
/// A whole calendar year at a glance: one entry per month (Jan–Dec, including
/// months with no budget) plus year totals. Income/Planned are budgeted amounts;
/// Spent is the derived actual spending.
/// </summary>
public class AnnualSummaryDto
{
    public int Year { get; set; }

    /// <summary>Always 12 entries, January → December.</summary>
    public List<AnnualMonthDto> Months { get; set; } = new();

    public decimal TotalIncome { get; set; }
    public decimal TotalPlanned { get; set; }
    public decimal TotalSpent { get; set; }
}

public class AnnualMonthDto
{
    public int Month { get; set; }

    /// <summary>"2026-06".</summary>
    public string Key { get; set; } = string.Empty;

    /// <summary>False for months the user hasn't created a budget for.</summary>
    public bool HasBudget { get; set; }

    public decimal Income { get; set; }
    public decimal Planned { get; set; }
    public decimal Spent { get; set; }
}
