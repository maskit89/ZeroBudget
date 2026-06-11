using MediatR;
using ZeroBudget.Application.Paychecks.Dtos;

namespace ZeroBudget.Application.Paychecks.Queries.GetPaychecks;

/// <summary>Lists the user's paychecks (with allocations) for one budget month.</summary>
public record GetPaychecksQuery(int Year, int Month) : IRequest<IReadOnlyList<PaycheckDto>>;
