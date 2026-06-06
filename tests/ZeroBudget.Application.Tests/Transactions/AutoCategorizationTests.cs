using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.Imports.Commands.ImportStatement;
using ZeroBudget.Application.Transactions;
using ZeroBudget.Application.Transactions.Commands.AssignTransaction;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;
using ZeroBudget.Infrastructure.Persistence;
using ZeroBudget.Infrastructure.Statements;
using ZeroBudget.Application.Tests.Imports;
using ZeroBudget.Application.Tests.TestDoubles;

namespace ZeroBudget.Application.Tests.Transactions;

public class AutoCategorizationTests
{
    private sealed class CurrentUserStub(string? userId) : ICurrentUser
    {
        public string? UserId { get; } = userId;
    }

    private static ApplicationDbContext NewContext() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"zbb-rules-{Guid.NewGuid()}")
            .Options);

    private static BudgetItem SeedMonthWithFood(ApplicationDbContext db, string ownerId, int year, int month)
    {
        var groceries = new BudgetItem { Name = "Groceries", PlannedAmount = 400m };
        db.BudgetMonths.Add(new BudgetMonth
        {
            OwnerId = ownerId,
            Year = year,
            Month = month,
            Categories = new List<BudgetCategory>
            {
                new() { Name = "Food", Items = new List<BudgetItem> { groceries } },
            },
        });
        db.SaveChanges();
        return groceries;
    }

    private static void SeedRule(ApplicationDbContext db, string ownerId, string payee, string cat, string item)
    {
        db.CategorizationRules.Add(new CategorizationRule
        {
            OwnerId = ownerId,
            PayeeKey = CategorizationRule.NormalizeKey(payee),
            CategoryName = cat,
            ItemName = item,
        });
        db.SaveChanges();
    }

    // --- AutoCategorizer -----------------------------------------------------

    [Fact]
    public async Task Apply_AssignsMatchingPayeeToTheLineInThatMonth()
    {
        await using var db = NewContext();
        var groceries = SeedMonthWithFood(db, "user-1", 2026, 6);
        SeedRule(db, "user-1", "REWE", "Food", "Groceries");

        var txMatch = new Transaction { OwnerId = "user-1", Payee = "REWE", Date = new DateOnly(2026, 6, 5), Type = TransactionType.Expense };
        var txOther = new Transaction { OwnerId = "user-1", Payee = "Unknown Shop", Date = new DateOnly(2026, 6, 5), Type = TransactionType.Expense };

        var count = await AutoCategorizer.ApplyAsync(db, "user-1", new[] { txMatch, txOther }, CancellationToken.None);

        count.Should().Be(1);
        txMatch.BudgetItemId.Should().Be(groceries.Id);
        txOther.BudgetItemId.Should().BeNull();
    }

    [Fact]
    public async Task Apply_DoesNotAssign_WhenNoBudgetExistsForThatMonth()
    {
        await using var db = NewContext();
        SeedMonthWithFood(db, "user-1", 2026, 6);
        SeedRule(db, "user-1", "REWE", "Food", "Groceries");

        // Transaction dated in a month with no budget.
        var tx = new Transaction { OwnerId = "user-1", Payee = "REWE", Date = new DateOnly(2025, 1, 5), Type = TransactionType.Expense };

        var count = await AutoCategorizer.ApplyAsync(db, "user-1", new[] { tx }, CancellationToken.None);

        count.Should().Be(0);
        tx.BudgetItemId.Should().BeNull();
    }

    [Fact]
    public async Task Apply_IgnoresOtherUsersRules()
    {
        await using var db = NewContext();
        SeedMonthWithFood(db, "user-1", 2026, 6);
        SeedRule(db, "user-2", "REWE", "Food", "Groceries"); // rule belongs to someone else

        var tx = new Transaction { OwnerId = "user-1", Payee = "REWE", Date = new DateOnly(2026, 6, 5), Type = TransactionType.Expense };

        var count = await AutoCategorizer.ApplyAsync(db, "user-1", new[] { tx }, CancellationToken.None);

        count.Should().Be(0);
    }

    // --- Learn on manual assignment -----------------------------------------

    [Fact]
    public async Task Assigning_LearnsAndUpdatesTheRule()
    {
        await using var db = NewContext();
        var groceries = SeedMonthWithFood(db, "user-1", 2026, 6);
        var tx = new Transaction { OwnerId = "user-1", Payee = "REWE", Date = new DateOnly(2026, 6, 5), Type = TransactionType.Expense };
        db.Transactions.Add(tx);
        await db.SaveChangesAsync();

        var handler = new AssignTransactionCommandHandler(db, new CurrentUserStub("user-1"));
        await handler.Handle(new AssignTransactionCommand(tx.Id, groceries.Id), CancellationToken.None);

        var rule = await db.CategorizationRules.SingleAsync();
        rule.PayeeKey.Should().Be("rewe");
        rule.CategoryName.Should().Be("Food");
        rule.ItemName.Should().Be("Groceries");

        // Re-assigning the same payee to a different line upserts (not duplicates).
        var dining = new BudgetItem { Name = "Dining Out", BudgetCategoryId = groceries.BudgetCategoryId };
        db.BudgetItems.Add(dining);
        await db.SaveChangesAsync();

        await handler.Handle(new AssignTransactionCommand(tx.Id, dining.Id), CancellationToken.None);

        (await db.CategorizationRules.CountAsync()).Should().Be(1);
        (await db.CategorizationRules.SingleAsync()).ItemName.Should().Be("Dining Out");
    }

    // --- Import integration --------------------------------------------------

    [Fact]
    public async Task Import_AutoCategorizesEntriesWithAKnownPayee()
    {
        await using var db = NewContext();
        // The CAMT.053 sample's rent entry: payee "Landlord GmbH", dated 2026-06-01.
        var rent = new BudgetItem { Name = "Rent", PlannedAmount = 1100m };
        db.BudgetMonths.Add(new BudgetMonth
        {
            OwnerId = "user-1",
            Year = 2026,
            Month = 6,
            Categories = new List<BudgetCategory>
            {
                new() { Name = "Housing", Items = new List<BudgetItem> { rent } },
            },
        });
        await db.SaveChangesAsync();
        SeedRule(db, "user-1", "Landlord GmbH", "Housing", "Rent");

        var handler = new ImportStatementCommandHandler(db, new CurrentUserStub("user-1"), new Camt053StatementParser(), new FakeExchangeRateProvider());
        var result = await handler.Handle(new ImportStatementCommand(Camt053Samples.ThreeEntries), CancellationToken.None);

        result.Imported.Should().Be(3);
        result.AutoCategorized.Should().Be(1); // only the rent entry had a rule

        var rentTx = await db.Transactions.SingleAsync(t => t.BankReference == "REF-RENT-001");
        rentTx.BudgetItemId.Should().Be(rent.Id);
    }
}
