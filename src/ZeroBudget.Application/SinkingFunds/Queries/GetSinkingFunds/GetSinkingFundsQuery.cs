using MediatR;
using ZeroBudget.Application.SinkingFunds.Dtos;

namespace ZeroBudget.Application.SinkingFunds.Queries.GetSinkingFunds;

/// <summary>
/// Lists the user's sinking funds with their derived balance, required monthly
/// contribution, projection and status. <paramref name="AsOf"/> defaults to today and
/// is injectable so the accrual maths are deterministic in tests.
/// </summary>
public record GetSinkingFundsQuery(bool IncludeArchived = false, DateOnly? AsOf = null)
    : IRequest<IReadOnlyList<SinkingFundDto>>;
