using MediatR;
using ZeroBudget.Application.SinkingFunds.Dtos;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Application.SinkingFunds.Commands.UpdateSinkingFund;

/// <summary>Edits a sinking fund's definition. Returns it with refreshed derived figures.</summary>
public record UpdateSinkingFundCommand(
    Guid Id,
    string Name,
    FundKind Kind,
    decimal TargetAmount,
    DateOnly? TargetDate,
    DateOnly? CoverStart,
    DateOnly? CoverEnd,
    AccrualMethod Accrual,
    bool RecurAnnually,
    decimal OpeningBalance,
    DateOnly? OpeningAsOf,
    Guid? FundingAccountId) : IRequest<SinkingFundDto>;
