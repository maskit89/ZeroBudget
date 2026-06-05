using Xunit;
using ZeroBudget.Domain.Entities;

namespace ZeroBudget.Application.Tests.Domain;

/// <summary>
/// Validates the core zero-based-budgeting metric: RemainingToBudget == Income - Sum(Planned).
/// These are pure domain tests — no database, no mocks.
/// </summary>
public class RemainingToBudgetTests
{
    private static BudgetMonth BuildMonth(decimal income, params decimal[] plannedAmounts)
    {
        var category = new BudgetCategory
        {
            Name = "Test",
            Items = plannedAmounts
                .Select((amount, i) => new BudgetItem { Name = $"Item {i}", PlannedAmount = amount })
                .ToList()
        };

        return new BudgetMonth
        {
            OwnerId = "user-1",
            Year = 2026,
            Month = 6,
            TotalIncome = income,
            Categories = new List<BudgetCategory> { category }
        };
    }

    [Fact]
    public void RemainingToBudget_IsPositive_WhenIncomeExceedsPlanned()
    {
        var month = BuildMonth(income: 3000m, 1000m, 500m);

        Assert.Equal(1500m, month.RemainingToBudget);
        Assert.False(month.IsBalanced);
    }

    [Fact]
    public void RemainingToBudget_IsZero_WhenEveryEuroIsAssigned()
    {
        var month = BuildMonth(income: 2000m, 1200m, 800m);

        Assert.Equal(0m, month.RemainingToBudget);
        Assert.True(month.IsBalanced);
    }

    [Fact]
    public void RemainingToBudget_IsNegative_WhenOverBudgeted()
    {
        var month = BuildMonth(income: 1000m, 700m, 600m);

        Assert.Equal(-300m, month.RemainingToBudget);
        Assert.False(month.IsBalanced);
    }

    [Fact]
    public void RemainingToBudget_EqualsIncome_WhenNothingIsPlanned()
    {
        var month = BuildMonth(income: 2500m); // no items

        Assert.Equal(0m, month.TotalPlanned);
        Assert.Equal(2500m, month.RemainingToBudget);
    }

    [Fact]
    public void RemainingToBudget_HandlesZeroIncomeGracefully()
    {
        // Edge case: no income but planned spending -> fully over-budgeted, no throw.
        var month = BuildMonth(income: 0m, 100m, 50m);

        Assert.Equal(-150m, month.RemainingToBudget);
        Assert.False(month.IsBalanced);
    }

    [Fact]
    public void RemainingToBudget_IsZero_WhenIncomeAndPlannedAreBothZero()
    {
        var month = BuildMonth(income: 0m);

        Assert.Equal(0m, month.RemainingToBudget);
        Assert.True(month.IsBalanced);
    }

    [Fact]
    public void RemainingToBudget_PreservesFourDecimalPrecision()
    {
        // Proves no rounding error creeps in for sub-cent Euro amounts.
        var month = BuildMonth(income: 100.0000m, 33.3333m, 33.3333m, 33.3333m);

        Assert.Equal(0.0001m, month.RemainingToBudget);
    }

    [Theory]
    [InlineData(5000, 4999.99, 0.01)]
    [InlineData(1234.5678, 1234.5678, 0)]
    [InlineData(0, 0.0001, -0.0001)]
    public void RemainingToBudget_ComputesAcrossRanges(decimal income, decimal planned, decimal expected)
    {
        var month = BuildMonth(income, planned);

        Assert.Equal(expected, month.RemainingToBudget);
    }

    [Fact]
    public void TotalPlanned_SumsAcrossMultipleCategories()
    {
        var month = new BudgetMonth
        {
            TotalIncome = 1000m,
            Categories = new List<BudgetCategory>
            {
                new() { Name = "Housing", Items = new List<BudgetItem> { new() { PlannedAmount = 600m } } },
                new() { Name = "Food", Items = new List<BudgetItem> { new() { PlannedAmount = 250m } } },
            }
        };

        Assert.Equal(850m, month.TotalPlanned);
        Assert.Equal(150m, month.RemainingToBudget);
    }
}
