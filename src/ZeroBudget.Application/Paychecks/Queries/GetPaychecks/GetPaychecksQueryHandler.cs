using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.Paychecks.Dtos;

namespace ZeroBudget.Application.Paychecks.Queries.GetPaychecks;

public class GetPaychecksQueryHandler : IRequestHandler<GetPaychecksQuery, IReadOnlyList<PaycheckDto>>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public GetPaychecksQueryHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<PaycheckDto>> Handle(
        GetPaychecksQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        var month = await _db.BudgetMonths
            .AsNoTracking()
            .FirstOrDefaultAsync(
                m => m.OwnerId == userId && m.Year == request.Year && m.Month == request.Month,
                cancellationToken);
        if (month is null)
        {
            return Array.Empty<PaycheckDto>();
        }

        var paychecks = await _db.Paychecks
            .AsNoTracking()
            .Include(p => p.Allocations)
                .ThenInclude(a => a.BudgetItem)
            .Where(p => p.OwnerId == userId && p.BudgetMonthId == month.Id)
            .OrderBy(p => p.DisplayOrder)
                .ThenBy(p => p.Date)
            .ToListAsync(cancellationToken);

        return paychecks.Select(p => p.ToDto()).ToList();
    }
}
