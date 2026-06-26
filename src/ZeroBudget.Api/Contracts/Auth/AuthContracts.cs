using System.ComponentModel.DataAnnotations;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Api.Contracts.Auth;

public record RegisterRequest(
    [Required, EmailAddress] string Email,
    [Required, MinLength(8)] string Password,
    [Required] string FirstName,
    [Required] string LastName,
    string? PreferredCurrency,
    string? NumberFormat,
    bool AcceptedTerms);

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

/// <summary>Self-service profile + money-display preferences for the authenticated login.</summary>
public record UpdatePreferencesRequest(
    string? FirstName,
    string? LastName,
    string? PreferredCurrency,
    string? NumberFormat);

/// <summary>The login's current name + money-display preferences.</summary>
public record PreferencesResponse(
    string? FirstName,
    string? LastName,
    string? DisplayName,
    string PreferredCurrency,
    string NumberFormat);

/// <summary>The authenticated login's identity, household, access level and preferences.</summary>
public record MeResponse(
    string UserId,
    string Email,
    string? DisplayName,
    HouseholdRole Role,
    string OwnerId,
    Guid? MemberId,
    string? FirstName,
    string? LastName,
    string PreferredCurrency,
    string NumberFormat);
