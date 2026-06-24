using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.SinkingFunds.Dtos;
using ZeroBudget.Domain.Services;

namespace ZeroBudget.Application.SinkingFunds.Commands.ArchiveSinkingFund;

public class ArchiveSinkingFundCommandHandler
    : IRequestHandler<ArchiveSinkingFundCommand, SinkingFundDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public ArchiveSinkingFundCommandHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<SinkingFundDto> Handle(
        ArchiveSinkingFundCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.OwnerId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        var fund = await _db.SinkingFunds
            .FirstOrDefaultAsync(f => f.Id == request.Id, cancellationToken)
            ?? throw new NotFoundException($"Sinking fund {request.Id} was not found.");

        if (fund.OwnerId != userId)
        {
            throw new ForbiddenAccessException();
        }

        fund.IsArchived = request.Archived;
        await _db.SaveChangesAsync(cancellationToken);

        var asOf = DateOnly.FromDateTime(DateTime.UtcNow);
        var tracked = await FundBalances.ComputeAsync(_db, userId, cancellationToken);
        var balance = fund.OpeningBalance + tracked.GetValueOrDefault(fund.Id);
        var required = FundAccrualCalculator.RequiredMonthlyContribution(fund, asOf, balance);
        return fund.ToDto(balance, required, asOf);
    }
}
