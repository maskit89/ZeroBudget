using Microsoft.AspNetCore.Identity;
using ZeroBudget.Application.Common.Interfaces;

namespace ZeroBudget.Infrastructure.Identity;

/// <summary>
/// <see cref="IIdentityService"/> backed by ASP.NET Core Identity's <see cref="UserManager{TUser}"/>.
/// Keeps the Identity dependency in Infrastructure while Application handlers work against the
/// abstraction.
/// </summary>
public class IdentityService : IIdentityService
{
    private readonly UserManager<ApplicationUser> _userManager;

    public IdentityService(UserManager<ApplicationUser> userManager)
    {
        _userManager = userManager;
    }

    public async Task<bool> EmailExistsAsync(string email) =>
        await _userManager.FindByEmailAsync(email) is not null;

    public async Task<UserAccount?> FindByEmailAsync(string email)
    {
        var user = await _userManager.FindByEmailAsync(email);
        return user is null ? null : new UserAccount(user.Id, user.Email!, user.DisplayName);
    }

    public async Task<UserAccount?> FindByIdAsync(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId);
        return user is null ? null : new UserAccount(user.Id, user.Email!, user.DisplayName);
    }

    public async Task<CreateUserResult> CreateUserAsync(string email, string password, string? displayName)
    {
        var user = new ApplicationUser { UserName = email, Email = email, DisplayName = displayName };
        var result = await _userManager.CreateAsync(user, password);
        return result.Succeeded
            ? CreateUserResult.Success(user.Id)
            : CreateUserResult.Failure(result.Errors.Select(e => e.Description));
    }

    public async Task<IReadOnlyList<string>> ChangePasswordAsync(
        string userId, string currentPassword, string newPassword)
    {
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
        {
            return new[] { "User not found." };
        }

        var result = await _userManager.ChangePasswordAsync(user, currentPassword, newPassword);
        return result.Succeeded ? Array.Empty<string>() : result.Errors.Select(e => e.Description).ToArray();
    }
}
