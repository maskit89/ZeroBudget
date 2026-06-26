using Microsoft.EntityFrameworkCore;
using ZeroBudget.Domain.Entities;

namespace ZeroBudget.Infrastructure.Persistence;

/// <summary>
/// Guarantees a household is never "0 members": the owner is themselves a
/// <see cref="HouseholdMember"/> (member #1). A person is a member, so a household of one
/// is solo and two-or-more is shared. New accounts get their owner member at registration
/// (<see cref="EnsureOwnerMemberAsync"/>); pre-existing accounts are backfilled on startup
/// (<see cref="BackfillOwnerMembersAsync"/>). Both are idempotent — a household that already
/// has any member is left untouched, so this never adds a duplicate or disturbs a shared
/// household (e.g. one that already has two members).
/// </summary>
public static class OwnerMemberSeeder
{
    private const int MaxNameLength = 120; // matches HouseholdMemberConfiguration

    /// <summary>
    /// The display name for an auto-created owner member: their first name, falling back to
    /// the display name, then the local part of their email, then a generic "You".
    /// </summary>
    public static string ResolveOwnerName(string? firstName, string? displayName, string? email)
    {
        if (!string.IsNullOrWhiteSpace(firstName)) return Clamp(firstName);
        if (!string.IsNullOrWhiteSpace(displayName)) return Clamp(displayName);
        if (!string.IsNullOrWhiteSpace(email))
        {
            var at = email.IndexOf('@');
            return Clamp(at > 0 ? email[..at] : email);
        }
        return "You";
    }

    /// <summary>
    /// Creates the owner as member #1 for <paramref name="ownerId"/> if the household has no
    /// members yet. No-op (and no duplicate) when one already exists. Used at registration.
    /// </summary>
    public static async Task EnsureOwnerMemberAsync(
        ApplicationDbContext db, string ownerId, string name, CancellationToken ct = default)
    {
        var hasMember = await db.HouseholdMembers.AnyAsync(m => m.OwnerId == ownerId, ct);
        if (hasMember)
        {
            return;
        }

        db.HouseholdMembers.Add(NewOwnerMember(ownerId, name));
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// For every household whose owner login exists but has no members, creates an owner
    /// member named from that login. Idempotent; safe to run on every boot.
    /// </summary>
    public static async Task BackfillOwnerMembersAsync(
        ApplicationDbContext db, CancellationToken ct = default)
    {
        // Distinct households (keyed by owner id) across all memberships.
        var ownerIds = await db.HouseholdMemberships
            .Select(m => m.OwnerId)
            .Distinct()
            .ToListAsync(ct);
        if (ownerIds.Count == 0)
        {
            return;
        }

        var ownersWithMembers = (await db.HouseholdMembers
            .Select(m => m.OwnerId)
            .Distinct()
            .ToListAsync(ct))
            .ToHashSet();

        var needing = ownerIds.Where(id => !ownersWithMembers.Contains(id)).ToList();
        if (needing.Count == 0)
        {
            return;
        }

        // Resolve names from the owner logins; skip owners whose user row is missing.
        var owners = await db.Users
            .Where(u => needing.Contains(u.Id))
            .Select(u => new { u.Id, u.FirstName, u.DisplayName, u.Email })
            .ToListAsync(ct);

        foreach (var u in owners)
        {
            db.HouseholdMembers.Add(NewOwnerMember(u.Id, ResolveOwnerName(u.FirstName, u.DisplayName, u.Email)));
        }

        await db.SaveChangesAsync(ct);
    }

    private static HouseholdMember NewOwnerMember(string ownerId, string name) => new()
    {
        OwnerId = ownerId,
        Name = string.IsNullOrWhiteSpace(name) ? "You" : Clamp(name),
        NetMonthlyIncome = 0m, // captured later — we don't ask for income at sign-up
        DisplayOrder = 0,
        IsArchived = false,
    };

    private static string Clamp(string value)
    {
        var trimmed = value.Trim();
        return trimmed.Length <= MaxNameLength ? trimmed : trimmed[..MaxNameLength];
    }
}
