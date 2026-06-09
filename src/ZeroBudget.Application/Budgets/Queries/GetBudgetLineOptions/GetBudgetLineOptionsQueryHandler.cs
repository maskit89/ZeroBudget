using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;

namespace ZeroBudget.Application.Budgets.Queries.GetBudgetLineOptions;

public class GetBudgetLineOptionsQueryHandler
    : IRequestHandler<GetBudgetLineOptionsQuery, IReadOnlyList<BudgetLineOptionDto>>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public GetBudgetLineOptionsQueryHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<BudgetLineOptionDto>> Handle(
        GetBudgetLineOptionsQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        // Every (category, line) name pair across all of the user's budgets.
        var pairs = await (
            from c in _db.BudgetCategories.AsNoTracking()
            join m in _db.BudgetMonths.AsNoTracking() on c.BudgetMonthId equals m.Id
            join i in _db.BudgetItems.AsNoTracking() on c.Id equals i.BudgetCategoryId
            where m.OwnerId == userId
            select new { CategoryName = c.Name, ItemName = i.Name })
            .ToListAsync(cancellationToken);

        // Merge case-insensitively across months, keeping the first-seen display casing
        // and ordering everything alphabetically for a stable picker.
        return pairs
            .Where(p => !string.IsNullOrWhiteSpace(p.CategoryName) && !string.IsNullOrWhiteSpace(p.ItemName))
            .GroupBy(p => p.CategoryName, StringComparer.OrdinalIgnoreCase)
            .OrderBy(g => g.Key, StringComparer.OrdinalIgnoreCase)
            .Select(g => new BudgetLineOptionDto
            {
                CategoryName = g.Key,
                ItemNames = g
                    .Select(p => p.ItemName)
                    .GroupBy(n => n, StringComparer.OrdinalIgnoreCase)
                    .Select(ig => ig.Key)
                    .OrderBy(n => n, StringComparer.OrdinalIgnoreCase)
                    .ToList(),
            })
            .ToList();
    }
}
