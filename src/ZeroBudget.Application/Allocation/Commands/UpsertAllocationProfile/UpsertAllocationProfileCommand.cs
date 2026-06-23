using MediatR;
using ZeroBudget.Application.Allocation.Dtos;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Application.Allocation.Commands.UpsertAllocationProfile;

/// <summary>Creates or replaces the household's allocation profile (rules replaced wholesale). Returns it.</summary>
public record UpsertAllocationProfileCommand(
    Guid? Id,
    string Name,
    Guid? SourceAccountId,
    IReadOnlyList<AllocationRuleSpec> Rules,
    int BalanceLeanPercent = 25) : IRequest<AllocationProfileDto>;

public record AllocationRuleSpec(int Order, AllocationRuleType Type, SplitMethod Split, decimal FixedAmountPerMember);
