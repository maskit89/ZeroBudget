using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Domain.Services;

/// <summary>
/// Pure (no I/O) income-allocation waterfall. Given each member's net income and an
/// ordered set of rules, it deducts each shared obligation from every member's running
/// balance and reports what each member is left with (their savings). Deterministic and
/// dependency-free, so it can be unit-tested directly against the source spreadsheet
/// (Chris 1259.14 / Liza 847.47).
///
/// Amounts for the fund-* rules are resolved by the caller (from the month's budget) and
/// passed in as <see cref="AllocationRuleInput.ResolvedTotal"/>, keeping this pure.
/// Equal/ratio splits round to the cent and give the last member the remainder so each
/// split sums exactly to its total.
/// </summary>
public static class IncomeAllocator
{
    public static AllocationResult Compute(
        IReadOnlyList<AllocationMember> members,
        IReadOnlyList<AllocationRuleInput> rules)
    {
        var pool = members.Sum(m => m.NetIncome);
        var totalNet = pool;
        var balances = members.ToDictionary(m => m.Id, m => m.NetIncome);
        var steps = new List<AllocationStep>();

        foreach (var rule in rules.OrderBy(r => r.Order))
        {
            switch (rule.Type)
            {
                case AllocationRuleType.FundEnvelopes:
                case AllocationRuleType.FundSinkingFunds:
                {
                    var shares = Split(members, rule.ResolvedTotal, rule.Split, totalNet);
                    foreach (var s in shares)
                    {
                        balances[s.MemberId] -= s.Amount;
                    }

                    steps.Add(new AllocationStep(rule.Type, rule.ResolvedTotal, shares));
                    break;
                }

                case AllocationRuleType.FixedPerMember:
                {
                    var shares = members
                        .Select(m => new MemberShare(m.Id, m.Name, rule.FixedAmountPerMember))
                        .ToList();
                    foreach (var s in shares)
                    {
                        balances[s.MemberId] -= s.Amount;
                    }

                    steps.Add(new AllocationStep(rule.Type, rule.FixedAmountPerMember * members.Count, shares));
                    break;
                }

                case AllocationRuleType.SplitRemainderToMembers:
                {
                    var shares = members
                        .Select(m => new MemberShare(m.Id, m.Name, balances[m.Id]))
                        .ToList();
                    steps.Add(new AllocationStep(rule.Type, shares.Sum(s => s.Amount), shares));
                    break;
                }
            }
        }

        var residuals = members
            .Select(m => new MemberResidual(m.Id, m.Name, m.NetIncome, balances[m.Id], m.SavingsAccountId))
            .ToList();

        return new AllocationResult(pool, steps, residuals);
    }

    private static IReadOnlyList<MemberShare> Split(
        IReadOnlyList<AllocationMember> members, decimal total, SplitMethod split, decimal totalNet)
    {
        var n = members.Count;
        if (n == 0)
        {
            return Array.Empty<MemberShare>();
        }

        var shares = new List<MemberShare>(n);
        decimal allocated = 0m;
        for (var i = 0; i < n; i++)
        {
            var m = members[i];
            decimal amount;
            if (i == n - 1)
            {
                // The last member absorbs the rounding remainder so the split is exact.
                amount = total - allocated;
            }
            else
            {
                amount = split == SplitMethod.ByIncomeRatio && totalNet > 0m
                    ? Math.Round(total * (m.NetIncome / totalNet), 2, MidpointRounding.AwayFromZero)
                    : Math.Round(total / n, 2, MidpointRounding.AwayFromZero);
                allocated += amount;
            }

            shares.Add(new MemberShare(m.Id, m.Name, amount));
        }

        return shares;
    }
}

public record AllocationMember(Guid Id, string Name, decimal NetIncome, Guid? SavingsAccountId);

public record AllocationRuleInput(
    int Order, AllocationRuleType Type, SplitMethod Split, decimal FixedAmountPerMember, decimal ResolvedTotal);

public record MemberShare(Guid MemberId, string Name, decimal Amount);

public record AllocationStep(AllocationRuleType Type, decimal Total, IReadOnlyList<MemberShare> PerMember);

public record MemberResidual(Guid MemberId, string Name, decimal NetIncome, decimal Residual, Guid? SavingsAccountId);

public record AllocationResult(decimal Pool, IReadOnlyList<AllocationStep> Steps, IReadOnlyList<MemberResidual> Members);
