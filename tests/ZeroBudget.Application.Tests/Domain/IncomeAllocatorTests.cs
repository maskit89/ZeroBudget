using FluentAssertions;
using ZeroBudget.Domain.Enums;
using ZeroBudget.Domain.Services;
using Xunit;

namespace ZeroBudget.Application.Tests.Domain;

/// <summary>
/// The income-allocation waterfall, validated against the source spreadsheet's
/// Future Savings figures.
/// </summary>
public class IncomeAllocatorTests
{
    private static readonly Guid Chris = Guid.NewGuid();
    private static readonly Guid Liza = Guid.NewGuid();

    private static List<AllocationMember> Couple() => new()
    {
        new(Chris, "Chris", 4411.64m, null),
        new(Liza, "Liza", 3999.97m, null),
    };

    [Fact]
    public void Reproduces_TheSpreadsheet_Waterfall()
    {
        var rules = new List<AllocationRuleInput>
        {
            new(0, AllocationRuleType.FundEnvelopes, SplitMethod.Equal, 0m, ResolvedTotal: 3641m),
            new(1, AllocationRuleType.FundSinkingFunds, SplitMethod.Equal, 0m, ResolvedTotal: 2164m),
            new(2, AllocationRuleType.FixedPerMember, SplitMethod.Equal, FixedAmountPerMember: 250m, ResolvedTotal: 0m),
            new(3, AllocationRuleType.SplitRemainderToMembers, SplitMethod.Equal, 0m, 0m),
        };

        var result = IncomeAllocator.Compute(Couple(), rules);

        result.Pool.Should().Be(8411.61m);
        result.Members.Single(m => m.MemberId == Chris).Residual.Should().Be(1259.14m);
        result.Members.Single(m => m.MemberId == Liza).Residual.Should().Be(847.47m);

        // The surplus split equals the pool minus the funded obligations (3641 + 2164 + 500).
        result.Members.Sum(m => m.Residual).Should().Be(8411.61m - 3641m - 2164m - 500m);
    }

    [Fact]
    public void Equal_Split_SumsExactly_EvenWithOddCents()
    {
        var rules = new List<AllocationRuleInput>
        {
            new(0, AllocationRuleType.FundEnvelopes, SplitMethod.Equal, 0m, ResolvedTotal: 100.01m),
            new(1, AllocationRuleType.SplitRemainderToMembers, SplitMethod.Equal, 0m, 0m),
        };

        var step = IncomeAllocator.Compute(Couple(), rules).Steps.First();

        step.PerMember.Sum(s => s.Amount).Should().Be(100.01m); // 50.00 + 50.01
        step.PerMember.Select(s => s.Amount).Should().Contain(new[] { 50.00m, 50.01m });
    }

    [Fact]
    public void ByIncomeRatio_Split_SumsExactly_ToTheTotal()
    {
        var rules = new List<AllocationRuleInput>
        {
            new(0, AllocationRuleType.FundEnvelopes, SplitMethod.ByIncomeRatio, 0m, ResolvedTotal: 1000m),
            new(1, AllocationRuleType.SplitRemainderToMembers, SplitMethod.Equal, 0m, 0m),
        };

        var step = IncomeAllocator.Compute(Couple(), rules).Steps.First();

        step.PerMember.Sum(s => s.Amount).Should().Be(1000m);
        // Chris earns more, so he covers more of the shared cost.
        step.PerMember.Single(s => s.MemberId == Chris).Amount
            .Should().BeGreaterThan(step.PerMember.Single(s => s.MemberId == Liza).Amount);
    }
}
