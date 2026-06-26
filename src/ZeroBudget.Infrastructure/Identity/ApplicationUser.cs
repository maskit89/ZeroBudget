using Microsoft.AspNetCore.Identity;

namespace ZeroBudget.Infrastructure.Identity;

/// <summary>
/// The application's identity user. Extends <see cref="IdentityUser"/> (string GUID key)
/// so we get the full ASP.NET Core Identity stack — password hashing, lockout,
/// security stamps — for free. Budget entities reference this user via OwnerId.
/// </summary>
public class ApplicationUser : IdentityUser
{
    /// <summary>Friendly name shown in the UI; derived from <see cref="FirstName"/> + <see cref="LastName"/>.</summary>
    public string? DisplayName { get; set; }

    /// <summary>Given name, captured at registration.</summary>
    public string? FirstName { get; set; }

    /// <summary>Family name, captured at registration.</summary>
    public string? LastName { get; set; }

    /// <summary>
    /// The user's home currency (ISO 4217). Drives the app-wide default + display label;
    /// individual accounts may still hold their own currency. Defaults to EUR.
    /// </summary>
    public string PreferredCurrency { get; set; } = UserPreferences.DefaultCurrency;

    /// <summary>
    /// How money values are grouped/decimal-separated for this user (a stable key the
    /// client maps to a locale, e.g. "dot-comma"). Independent of <see cref="PreferredCurrency"/>.
    /// </summary>
    public string NumberFormat { get; set; } = UserPreferences.DefaultNumberFormat;

    /// <summary>When the user accepted the terms/privacy policy at registration; null for legacy logins.</summary>
    public DateTime? ConsentedUtc { get; set; }
}
