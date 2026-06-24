using MediatR;
using ZeroBudget.Application.Allocation.Dtos;
using ZeroBudget.Application.Common.Security;

namespace ZeroBudget.Application.Allocation.Commands.AllocateIncome;

/// <summary>
/// Commits the allocation for a month: routes each member's surplus into their personal
/// savings as a transfer. Idempotent — re-running replaces the month's prior allocation
/// transfers. Returns the computed result with the number of transfers created.
/// </summary>
[AllowLimited]
public record AllocateIncomeCommand(int Year, int Month, Guid? ProfileId = null)
    : IRequest<AllocationResultDto>;
