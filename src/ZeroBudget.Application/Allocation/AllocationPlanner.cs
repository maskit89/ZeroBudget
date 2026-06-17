using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;
using ZeroBudget.Domain.Services;

namespace ZeroBudget.Application.Allocation;

/// <summary>
/// Shared read-side for preview and commit: loads the owner's allocation profile and
/// active members, resolves the month's shared-obligation totals from the budget
/// (Expense-category planned → envelopes, Fund-category planned → sinking funds), and
/// runs the pure <see cref="IncomeAllocator"/>. No writes.
/// </summary>
public static class AllocationPlanner
{
    public static async Task<AllocationPlan> PlanAsync(
        IApplicationDbContext db, string ownerId, int year, int month, Guid? profileId, CancellationToken ct)
    {
        var profile = await db.AllocationProfiles
            .AsNoTracking()
            .Include(p => p.Rules)
            .Where(p => p.OwnerId == ownerId && (profileId == null || p.Id == profileId))
            .OrderBy(p => p.Name)
            .FirstOrDefaultAsync(ct);

        var members = await db.HouseholdMembers
            .AsNoTracking()
            .Where(m => m.OwnerId == ownerId && !m.IsArchived)
            .OrderBy(m => m.DisplayOrder)
                .ThenBy(m => m.Name)
            .ToListAsync(ct);

        // Shared-obligation totals derived live from the month's budget.
        var totals = await (
            from i in db.BudgetItems
            join c in db.BudgetCategories on i.BudgetCategoryId equals c.Id
            join bm in db.BudgetMonths on c.BudgetMonthId equals bm.Id
            where bm.OwnerId == ownerId && bm.Year == year && bm.Month == month
                  && (c.Kind == CategoryKind.Expense || c.Kind == CategoryKind.Fund)
            group i by c.Kind into g
            select new { Kind = g.Key, Total = g.Sum(x => x.PlannedAmount) })
            .ToListAsync(ct);

        var envelopes = totals.Where(t => t.Kind == CategoryKind.Expense).Sum(t => t.Total);
        var funds = totals.Where(t => t.Kind == CategoryKind.Fund).Sum(t => t.Total);

        var allocMembers = members
            .Select(m => new AllocationMember(m.Id, m.Name, m.NetMonthlyIncome, m.PersonalSavingsAccountId))
            .ToList();

        var ruleInputs = (profile?.Rules ?? Enumerable.Empty<AllocationRule>())
            .OrderBy(r => r.Order)
            .Select(r => new AllocationRuleInput(
                r.Order, r.Type, r.Split, r.FixedAmountPerMember,
                ResolvedTotal: r.Type switch
                {
                    AllocationRuleType.FundEnvelopes => envelopes,
                    AllocationRuleType.FundSinkingFunds => funds,
                    _ => 0m,
                }))
            .ToList();

        var result = IncomeAllocator.Compute(allocMembers, ruleInputs);
        return new AllocationPlan(result, profile, envelopes, funds);
    }
}

public record AllocationPlan(AllocationResult Result, AllocationProfile? Profile, decimal EnvelopesTotal, decimal FundsTotal);
