using MediatR;
using ZeroBudget.Application.Household.Dtos;

namespace ZeroBudget.Application.Household.Commands.ArchiveHouseholdMember;

/// <summary>Archives (or restores) a household member — soft, so history is kept. Returns the member.</summary>
public record ArchiveHouseholdMemberCommand(Guid Id, bool Archived = true) : IRequest<HouseholdMemberDto>;
