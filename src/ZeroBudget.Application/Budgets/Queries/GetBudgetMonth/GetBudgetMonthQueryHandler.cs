using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Budgets.Dtos;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;

namespace ZeroBudget.Application.Budgets.Queries.GetBudgetMonth;

public class GetBudgetMonthQueryHandler : IRequestHandler<GetBudgetMonthQuery, BudgetMonthDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public GetBudgetMonthQueryHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<BudgetMonthDto> Handle(GetBudgetMonthQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        // Ownership is enforced in the query itself: the OwnerId predicate means a
        // user can never project another user's budget, regardless of the month asked for.
        var month = await _db.BudgetMonths
            .AsNoTracking()
            .Include(m => m.Categories)
                .ThenInclude(c => c.Items)
            .FirstOrDefaultAsync(
                m => m.OwnerId == userId
                     && m.Year == request.Year
                     && m.Month == request.Month,
                cancellationToken);

        if (month is null)
        {
            throw new NotFoundException(
                $"No budget found for {request.Year:D4}-{request.Month:D2}.");
        }

        return month.ToDto();
    }
}
