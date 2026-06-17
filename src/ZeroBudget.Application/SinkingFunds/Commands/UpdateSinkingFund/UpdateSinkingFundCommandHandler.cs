using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.SinkingFunds.Dtos;
using ZeroBudget.Domain.Services;

namespace ZeroBudget.Application.SinkingFunds.Commands.UpdateSinkingFund;

public class UpdateSinkingFundCommandHandler
    : IRequestHandler<UpdateSinkingFundCommand, SinkingFundDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public UpdateSinkingFundCommandHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<SinkingFundDto> Handle(
        UpdateSinkingFundCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        var fund = await _db.SinkingFunds
            .FirstOrDefaultAsync(f => f.Id == request.Id, cancellationToken)
            ?? throw new NotFoundException($"Sinking fund {request.Id} was not found.");

        if (fund.OwnerId != userId)
        {
            throw new ForbiddenAccessException();
        }

        fund.Name = request.Name.Trim();
        fund.Kind = request.Kind;
        fund.TargetAmount = request.TargetAmount;
        fund.TargetDate = request.TargetDate;
        fund.CoverStart = request.CoverStart;
        fund.CoverEnd = request.CoverEnd;
        fund.Accrual = request.Accrual;
        fund.RecurAnnually = request.RecurAnnually;
        fund.OpeningBalance = request.OpeningBalance;
        fund.OpeningAsOf = request.OpeningAsOf;
        fund.FundingAccountId = request.FundingAccountId;

        await _db.SaveChangesAsync(cancellationToken);

        var asOf = DateOnly.FromDateTime(DateTime.UtcNow);
        var tracked = await FundBalances.ComputeAsync(_db, userId, cancellationToken);
        var balance = fund.OpeningBalance + tracked.GetValueOrDefault(fund.Id);
        var required = FundAccrualCalculator.RequiredMonthlyContribution(fund, asOf, balance);
        return fund.ToDto(balance, required, asOf);
    }
}
