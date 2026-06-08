using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.Rules.Dtos;

namespace ZeroBudget.Application.Rules.Queries.GetCategorizationRules;

public class GetCategorizationRulesQueryHandler
    : IRequestHandler<GetCategorizationRulesQuery, IReadOnlyList<CategorizationRuleDto>>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public GetCategorizationRulesQueryHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<CategorizationRuleDto>> Handle(
        GetCategorizationRulesQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        var rules = await _db.CategorizationRules
            .AsNoTracking()
            .Where(r => r.OwnerId == userId)
            .OrderBy(r => r.PayeeKey)
            .ToListAsync(cancellationToken);

        return rules.Select(r => r.ToDto()).ToList();
    }
}
