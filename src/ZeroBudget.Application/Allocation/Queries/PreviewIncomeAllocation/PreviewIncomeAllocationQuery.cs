using MediatR;
using ZeroBudget.Application.Allocation.Dtos;

namespace ZeroBudget.Application.Allocation.Queries.PreviewIncomeAllocation;

/// <summary>
/// Dry-run of the allocation waterfall for a month — what each rule would deduct and
/// what each member would be left with. Never writes; powers the preview UI.
/// </summary>
public record PreviewIncomeAllocationQuery(int Year, int Month, Guid? ProfileId = null)
    : IRequest<AllocationResultDto>;
