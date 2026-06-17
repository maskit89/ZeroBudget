using MediatR;
using ZeroBudget.Application.SinkingFunds.Dtos;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Application.SinkingFunds.Commands.CreateSinkingFund;

/// <summary>Defines a new sinking fund. Returns it with its derived figures.</summary>
public record CreateSinkingFundCommand(
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
