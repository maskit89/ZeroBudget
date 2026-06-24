using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Api.Services;
using ZeroBudget.Domain.Enums;
using ZeroBudget.Infrastructure.Persistence;

namespace ZeroBudget.Api.Middleware;

/// <summary>
/// After authentication, resolves the caller's household membership (one indexed lookup) and
/// stashes the household id + role into the per-request <see cref="HouseholdContext"/>. Doing
/// it server-side every request — rather than baking the role into the JWT — means a revoked
/// or downgraded membership takes effect immediately, regardless of token age.
/// </summary>
public class HouseholdResolutionMiddleware
{
    private readonly RequestDelegate _next;

    public HouseholdResolutionMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, ApplicationDbContext db, HouseholdContext household)
    {
        var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrEmpty(userId))
        {
            var membership = await db.HouseholdMemberships
                .AsNoTracking()
                .Where(m => m.UserId == userId && m.Status == MembershipStatus.Active)
                .Select(m => new { m.OwnerId, m.Role, m.MemberId })
                .FirstOrDefaultAsync(context.RequestAborted);

            if (membership is not null)
            {
                household.OwnerId = membership.OwnerId;
                household.Role = membership.Role;
                household.MemberId = membership.MemberId;
            }
            else
            {
                // No membership yet (e.g. a brand-new registrant before the owner row is
                // seeded, or pre-existing data): the caller owns their own household.
                household.OwnerId = userId;
                household.Role = HouseholdRole.Owner;
            }

            household.Resolved = true;
        }

        await _next(context);
    }
}
