using System.Security.Claims;
using ZeroBudget.Application.Common.Interfaces;

namespace ZeroBudget.Api.Services;

/// <summary>
/// Reads the authenticated user's id from the JWT claims on the current request.
/// Registered as scoped so each request resolves its own caller.
/// </summary>
public class CurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUser(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public string? UserId =>
        _httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);
}
