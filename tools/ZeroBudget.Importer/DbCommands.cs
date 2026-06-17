using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ZeroBudget.Infrastructure.Persistence;

namespace ZeroBudget.Importer;

/// <summary>Read-only database inspection used before any write (the "look before you leap" step).</summary>
internal static class DbCommands
{
    /// <summary>
    /// Resolves the household owner by email and prints how much ZeroBudget data already
    /// exists for them, so we know whether a commit would append to or collide with
    /// existing data. Purely read-only.
    /// </summary>
    public static async Task<int> Status(string connectionString, string email)
    {
        await using var provider = ImporterHost.Build(connectionString);
        using var scope = provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        Console.WriteLine($"Database : {connectionString}");
        if (!await db.Database.CanConnectAsync())
        {
            Console.Error.WriteLine("Cannot connect to the database.");
            return 1;
        }

        var normalized = email.ToUpperInvariant();
        var user = await db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.NormalizedEmail == normalized);

        if (user is null)
        {
            Console.WriteLine($"Owner    : NOT FOUND for '{email}'.");
            Console.WriteLine("Existing users:");
            foreach (var u in await db.Users.AsNoTracking().Select(u => u.Email).ToListAsync())
            {
                Console.WriteLine($"  - {u}");
            }
            return 1;
        }

        var owner = user.Id;
        Console.WriteLine($"Owner    : {email}  (id {owner})");
        Console.WriteLine();
        Console.WriteLine("Existing data for this owner:");
        Console.WriteLine($"  Accounts          : {await db.Accounts.CountAsync(a => a.OwnerId == owner)}");
        Console.WriteLine($"  Household members  : {await db.HouseholdMembers.CountAsync(m => m.OwnerId == owner)}");
        Console.WriteLine($"  Sinking funds      : {await db.SinkingFunds.CountAsync(f => f.OwnerId == owner)}");
        Console.WriteLine($"  Budget months      : {await db.BudgetMonths.CountAsync(m => m.OwnerId == owner)}");
        Console.WriteLine($"  Transactions       : {await db.Transactions.CountAsync(t => t.OwnerId == owner)}");
        Console.WriteLine($"  Allocation profiles: {await db.AllocationProfiles.CountAsync(p => p.OwnerId == owner)}");
        return 0;
    }
}
