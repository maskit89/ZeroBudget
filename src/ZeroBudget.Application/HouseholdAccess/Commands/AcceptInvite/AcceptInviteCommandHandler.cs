using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Application.HouseholdAccess.Commands.AcceptInvite;

public class AcceptInviteCommandHandler : IRequestHandler<AcceptInviteCommand, AcceptInviteResult>
{
    private readonly IApplicationDbContext _db;
    private readonly IIdentityService _identity;

    public AcceptInviteCommandHandler(IApplicationDbContext db, IIdentityService identity)
    {
        _db = db;
        _identity = identity;
    }

    public async Task<AcceptInviteResult> Handle(AcceptInviteCommand request, CancellationToken cancellationToken)
    {
        var hash = InviteToken.Hash(request.Token);

        var membership = await _db.HouseholdMemberships
            .FirstOrDefaultAsync(
                m => m.InviteTokenHash == hash && m.Status == MembershipStatus.Invited,
                cancellationToken)
            ?? throw new NotFoundException("This invite link is invalid or has already been used.");

        if (membership.InviteExpiresUtc is null || membership.InviteExpiresUtc < DateTime.UtcNow)
        {
            throw new ForbiddenAccessException("This invite link has expired.");
        }

        if (await _identity.EmailExistsAsync(membership.InvitedEmail))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Email"] = new[] { "An account with that email already exists." }
            });
        }

        var displayName = request.DisplayName ?? membership.DisplayName;
        var created = await _identity.CreateUserAsync(membership.InvitedEmail, request.Password, displayName);
        if (!created.Succeeded)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Password"] = created.Errors.ToArray()
            });
        }

        membership.UserId = created.UserId;
        membership.Status = MembershipStatus.Active;
        membership.InviteTokenHash = null;
        membership.InviteExpiresUtc = null;
        membership.DisplayName = displayName;
        await _db.SaveChangesAsync(cancellationToken);

        return new AcceptInviteResult(created.UserId!, membership.InvitedEmail, membership.Role);
    }
}
