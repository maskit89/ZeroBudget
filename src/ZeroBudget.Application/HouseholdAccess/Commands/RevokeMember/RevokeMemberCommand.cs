using MediatR;
using ZeroBudget.Application.Common.Security;

namespace ZeroBudget.Application.HouseholdAccess.Commands.RevokeMember;

/// <summary>Removes a login's access to the household. The owner cannot be removed. Owner-only.</summary>
[OwnerOnly]
public record RevokeMemberCommand(Guid MembershipId) : IRequest;
