using System.ComponentModel.DataAnnotations;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Api.Contracts.Auth;

public record RegisterRequest(
    [Required, EmailAddress] string Email,
    [Required, MinLength(8)] string Password,
    string? DisplayName);

public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password);

public record AuthResponse(
    string Token,
    DateTime ExpiresAtUtc,
    string UserId,
    string Email,
    HouseholdRole Role,
    string? DisplayName);

/// <summary>Redeems a one-time invite link and sets the new login's password.</summary>
public record AcceptInviteRequest(
    [Required] string Token,
    [Required, MinLength(8)] string Password,
    string? DisplayName);

/// <summary>Self-service password change for the authenticated login.</summary>
public record ChangePasswordRequest(
    [Required] string CurrentPassword,
    [Required, MinLength(8)] string NewPassword);

/// <summary>The authenticated login's identity, household and access level.</summary>
public record MeResponse(
    string UserId,
    string Email,
    string? DisplayName,
    HouseholdRole Role,
    string OwnerId,
    Guid? MemberId);
