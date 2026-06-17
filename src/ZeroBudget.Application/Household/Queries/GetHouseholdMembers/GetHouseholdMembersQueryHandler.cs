using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.Household.Dtos;

namespace ZeroBudget.Application.Household.Queries.GetHouseholdMembers;

public class GetHouseholdMembersQueryHandler
    : IRequestHandler<GetHouseholdMembersQuery, IReadOnlyList<HouseholdMemberDto>>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public GetHouseholdMembersQueryHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<HouseholdMemberDto>> Handle(
        GetHouseholdMembersQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        var members = await _db.HouseholdMembers
            .AsNoTracking()
            .Where(m => m.OwnerId == userId && (request.IncludeArchived || !m.IsArchived))
            .OrderBy(m => m.DisplayOrder)
                .ThenBy(m => m.Name)
            .ToListAsync(cancellationToken);

        // Income share is computed against the active members (the pool the allocation
        // engine splits); archived members get a 0 share.
        var totalActiveNet = members.Where(m => !m.IsArchived).Sum(m => m.NetMonthlyIncome);

        return members.Select(m => m.ToDto(totalActiveNet)).ToList();
    }
}
