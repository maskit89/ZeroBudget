using MediatR;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.SinkingFunds.Dtos;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Services;

namespace ZeroBudget.Application.SinkingFunds.Commands.CreateSinkingFund;

public class CreateSinkingFundCommandHandler
    : IRequestHandler<CreateSinkingFundCommand, SinkingFundDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public CreateSinkingFundCommandHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<SinkingFundDto> Handle(
        CreateSinkingFundCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        var fund = new SinkingFund
        {
            OwnerId = userId,
            Name = request.Name.Trim(),
            Kind = request.Kind,
            TargetAmount = request.TargetAmount,
            TargetDate = request.TargetDate,
            CoverStart = request.CoverStart,
            CoverEnd = request.CoverEnd,
            Accrual = request.Accrual,
            RecurAnnually = request.RecurAnnually,
            OpeningBalance = request.OpeningBalance,
            OpeningAsOf = request.OpeningAsOf,
            FundingAccountId = request.FundingAccountId,
        };

        _db.SinkingFunds.Add(fund);
        await _db.SaveChangesAsync(cancellationToken);

        // A brand-new fund has no contribution lines yet, so its balance is its opening.
        var asOf = DateOnly.FromDateTime(DateTime.UtcNow);
        var balance = fund.OpeningBalance;
        var required = FundAccrualCalculator.RequiredMonthlyContribution(fund, asOf, balance);
        return fund.ToDto(balance, required, asOf);
    }
}
