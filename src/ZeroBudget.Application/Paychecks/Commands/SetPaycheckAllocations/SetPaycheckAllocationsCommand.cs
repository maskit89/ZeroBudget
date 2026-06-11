using MediatR;
using ZeroBudget.Application.Paychecks.Dtos;

namespace ZeroBudget.Application.Paychecks.Commands.SetPaycheckAllocations;

/// <summary>
/// Replaces a paycheck's allocations wholesale (like splitting a transaction): an
/// empty list clears them. Each allocation earmarks part of the paycheck for a budget
/// line. Returns the recomputed paycheck.
/// </summary>
public record SetPaycheckAllocationsCommand(
    Guid PaycheckId,
    IReadOnlyList<PaycheckAllocationInput> Allocations) : IRequest<PaycheckDto>;

/// <summary>One earmark: an amount assigned to a budget line.</summary>
public record PaycheckAllocationInput(Guid BudgetItemId, decimal Amount);
