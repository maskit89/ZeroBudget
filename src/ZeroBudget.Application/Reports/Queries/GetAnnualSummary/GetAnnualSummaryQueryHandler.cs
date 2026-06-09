using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Budgets;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.Reports.Dtos;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Application.Reports.Queries.GetAnnualSummary;

public class GetAnnualSummaryQueryHandler : IRequestHandler<GetAnnualSummaryQuery, AnnualSummaryDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public GetAnnualSummaryQueryHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<AnnualSummaryDto> Handle(GetAnnualSummaryQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        var months = await _db.BudgetMonths
            .AsNoTracking()
            .Include(m => m.Categories)
                .ThenInclude(c => c.Items)
            .Where(m => m.OwnerId == userId && m.Year == request.Year)
            .ToListAsync(cancellationToken);

        var byMonth = months.ToDictionary(m => m.Month);

        var result = new AnnualSummaryDto { Year = request.Year };
        for (var month = 1; month <= 12; month++)
        {
            var entry = new AnnualMonthDto
            {
                Month = month,
                Key = $"{request.Year:D4}-{month:D2}",
                HasBudget = false,
            };

            if (byMonth.TryGetValue(month, out var budget))
            {
                await BudgetActuals.ApplyAsync(_db, userId, budget, cancellationToken);
                entry.HasBudget = true;
                entry.Income = budget.TotalIncome;
                entry.Planned = budget.TotalPlanned;
                entry.Spent = budget.Categories
                    .Where(c => c.Kind != CategoryKind.Income)
                    .Sum(c => c.TotalActual);
            }

            result.Months.Add(entry);
        }

        result.TotalIncome = result.Months.Sum(m => m.Income);
        result.TotalPlanned = result.Months.Sum(m => m.Planned);
        result.TotalSpent = result.Months.Sum(m => m.Spent);

        return result;
    }
}
