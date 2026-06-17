using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.SinkingFunds.Dtos;
using ZeroBudget.Domain.Services;

namespace ZeroBudget.Application.SinkingFunds.Queries.GetSinkingFunds;

public class GetSinkingFundsQueryHandler
    : IRequestHandler<GetSinkingFundsQuery, IReadOnlyList<SinkingFundDto>>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public GetSinkingFundsQueryHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<SinkingFundDto>> Handle(
        GetSinkingFundsQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        var asOf = request.AsOf ?? DateOnly.FromDateTime(DateTime.UtcNow);

        var funds = await _db.SinkingFunds
            .AsNoTracking()
            .Where(f => f.OwnerId == userId && (request.IncludeArchived || !f.IsArchived))
            .OrderBy(f => f.Name)
            .ToListAsync(cancellationToken);

        if (funds.Count == 0)
        {
            return Array.Empty<SinkingFundDto>();
        }

        var tracked = await FundBalances.ComputeAsync(_db, userId, cancellationToken);

        return funds
            .Select(f =>
            {
                var balance = f.OpeningBalance + tracked.GetValueOrDefault(f.Id);
                var required = FundAccrualCalculator.RequiredMonthlyContribution(f, asOf, balance);
                return f.ToDto(balance, required, asOf);
            })
            .ToList();
    }
}
