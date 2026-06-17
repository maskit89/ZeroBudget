using MediatR;
using ZeroBudget.Application.Household.Dtos;

namespace ZeroBudget.Application.Household.Queries.GetHouseholdMembers;

/// <summary>Lists the household's members with each one's share of total net income.</summary>
public record GetHouseholdMembersQuery(bool IncludeArchived = false)
    : IRequest<IReadOnlyList<HouseholdMemberDto>>;
