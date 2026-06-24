namespace ZeroBudget.Application.Common.Interfaces;

/// <summary>
/// Abstraction over ASP.NET Core Identity's <c>UserManager</c>, so Application handlers can
/// create logins and change passwords without depending on the Infrastructure Identity stack.
/// </summary>
public interface IIdentityService
{
    Task<bool> EmailExistsAsync(string email);

    Task<UserAccount?> FindByEmailAsync(string email);

    Task<UserAccount?> FindByIdAsync(string userId);

    Task<CreateUserResult> CreateUserAsync(string email, string password, string? displayName);

    Task<IReadOnlyList<string>> ChangePasswordAsync(string userId, string currentPassword, string newPassword);
}

/// <summary>A login as seen by the Application layer.</summary>
public record UserAccount(string Id, string Email, string? DisplayName);

/// <summary>Result of creating a login. <see cref="UserId"/> is set only when <see cref="Succeeded"/>.</summary>
public record CreateUserResult(bool Succeeded, string? UserId, IReadOnlyList<string> Errors)
{
    public static CreateUserResult Success(string userId) => new(true, userId, Array.Empty<string>());
    public static CreateUserResult Failure(IEnumerable<string> errors) => new(false, null, errors.ToArray());
}
