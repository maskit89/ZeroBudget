using Microsoft.AspNetCore.Identity;

namespace ZeroBudget.Infrastructure.Identity;

/// <summary>
/// The application's identity user. Extends <see cref="IdentityUser"/> (string GUID key)
/// so we get the full ASP.NET Core Identity stack — password hashing, lockout,
/// security stamps — for free. Budget entities reference this user via OwnerId.
/// </summary>
public class ApplicationUser : IdentityUser
{
    public string? DisplayName { get; set; }
}
