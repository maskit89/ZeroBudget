using MediatR;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Application.HouseholdAccess.Commands.AcceptInvite;

/// <summary>
/// Redeems a one-time invite link: creates the login behind the pending membership and
/// activates it. Anonymous — the token is the credential. Returns enough for the API to
/// issue a JWT.
/// </summary>
public record AcceptInviteCommand(string Token, string Password, string? DisplayName)
    : IRequest<AcceptInviteResult>;

public record AcceptInviteResult(string UserId, string Email, HouseholdRole Role);
