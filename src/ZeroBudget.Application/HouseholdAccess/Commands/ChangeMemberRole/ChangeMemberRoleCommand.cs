using MediatR;
using ZeroBudget.Application.Common.Security;
using ZeroBudget.Application.HouseholdAccess.Dtos;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Application.HouseholdAccess.Commands.ChangeMemberRole;

/// <summary>Changes a membership's access level. The owner's role cannot be changed. Owner-only.</summary>
[OwnerOnly]
public record ChangeMemberRoleCommand(Guid MembershipId, HouseholdRole Role) : IRequest<MembershipDto>;
