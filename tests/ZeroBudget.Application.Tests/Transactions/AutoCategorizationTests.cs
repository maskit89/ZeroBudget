using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.Imports.Commands.ImportStatement;
using ZeroBudget.Application.Transactions;
using ZeroBudget.Application.Transactions.Commands.CreateTransaction;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;
using ZeroBudget.Infrastructure.Persistence;
using ZeroBudget.Infrastructure.Statements;
using ZeroBudget.Application.Tests.Imports;
using ZeroBudget.Application.Tests.TestDoubles;

namespace ZeroBudget.Application.Tests.Transactions;

/// <summary>
/// The auto-categorizer is now a quiet, zero-config fallback: a transaction logged
/// without a budget line inherits the line of the user's most recent earlier
/// transaction with the same description. There are no user-managed rules.
/// </summary>
public class AutoCategorizationTests
{
    private sealed class CurrentUserStub(string? userId) : ICurrentUser
    {
        public string? UserId { get; } = userId;
    }

    private static ApplicationDbContext NewContext() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"zbb-autocat-{Guid.NewGuid()}")
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

    /// <summary>Seed a previously-categorized transaction (the thing future matches learn from).</summary>
    private static void SeedAssignedTransaction(
        ApplicationDbContext db, string ownerId, string payee, Guid budgetItemId, DateOnly date)
    {
        db.Transactions.Add(new Transaction
        {
            OwnerId = ownerId,
            Payee = payee,
            BudgetItemId = budgetItemId,
            Date = date,
            Type = TransactionType.Expense,
        });
        db.SaveChanges();
    }

    // --- AutoCategorizer.ApplyAsync -----------------------------------------

    [Fact]
    public async Task Apply_InheritsLineFromMostRecentTransactionWithTheSameDescription()
    {
        await using var db = NewContext();
        var groceries = SeedMonthWithFood(db, "user-1", 2026, 6);
        SeedAssignedTransaction(db, "user-1", "REWE", groceries.Id, new DateOnly(2026, 6, 1));

        var match = new Transaction { OwnerId = "user-1", Payee = "REWE", Date = new DateOnly(2026, 6, 5), Type = TransactionType.Expense };
        var noMatch = new Transaction { OwnerId = "user-1", Payee = "Unknown Shop", Date = new DateOnly(2026, 6, 5), Type = TransactionType.Expense };

        var count = await AutoCategorizer.ApplyAsync(db, "user-1", new[] { match, noMatch }, CancellationToken.None);

        count.Should().Be(1);
        match.BudgetItemId.Should().Be(groceries.Id);
        noMatch.BudgetItemId.Should().BeNull();
    }

    [Fact]
    public async Task Apply_DoesNotAssign_WhenNoPriorTransactionHasThatDescription()
    {
        await using var db = NewContext();
        SeedMonthWithFood(db, "user-1", 2026, 6);

        var tx = new Transaction { OwnerId = "user-1", Payee = "REWE", Date = new DateOnly(2026, 6, 5), Type = TransactionType.Expense };

        var count = await AutoCategorizer.ApplyAsync(db, "user-1", new[] { tx }, CancellationToken.None);

        count.Should().Be(0);
        tx.BudgetItemId.Should().BeNull();
    }

    [Fact]
    public async Task Apply_NeverInheritsAcrossOwners()
    {
        await using var db = NewContext();
        var groceries = SeedMonthWithFood(db, "user-1", 2026, 6);
        // The only prior assigned transaction belongs to someone else.
        SeedAssignedTransaction(db, "user-2", "REWE", groceries.Id, new DateOnly(2026, 6, 1));

        var tx = new Transaction { OwnerId = "user-1", Payee = "REWE", Date = new DateOnly(2026, 6, 5), Type = TransactionType.Expense };

        var count = await AutoCategorizer.ApplyAsync(db, "user-1", new[] { tx }, CancellationToken.None);

        count.Should().Be(0);
        tx.BudgetItemId.Should().BeNull();
    }

    [Fact]
    public async Task Apply_MatchesCaseAndWhitespaceInsensitively()
    {
        await using var db = NewContext();
        var groceries = SeedMonthWithFood(db, "user-1", 2026, 6);
        SeedAssignedTransaction(db, "user-1", "REWE  Markt", groceries.Id, new DateOnly(2026, 6, 1));

        var tx = new Transaction { OwnerId = "user-1", Payee = "  rewe markt ", Date = new DateOnly(2026, 6, 5), Type = TransactionType.Expense };

        var count = await AutoCategorizer.ApplyAsync(db, "user-1", new[] { tx }, CancellationToken.None);

        count.Should().Be(1);
        tx.BudgetItemId.Should().Be(groceries.Id);
    }

    [Fact]
    public async Task Apply_PrefersTheMostRecentMatchingLine()
    {
        await using var db = NewContext();
        var groceries = SeedMonthWithFood(db, "user-1", 2026, 6);
        var dining = new BudgetItem { Name = "Dining Out", BudgetCategoryId = groceries.BudgetCategoryId };
        db.BudgetItems.Add(dining);
        await db.SaveChangesAsync();

        // Older assignment to Groceries, newer assignment to Dining Out — newer wins.
        SeedAssignedTransaction(db, "user-1", "REWE", groceries.Id, new DateOnly(2026, 6, 1));
        SeedAssignedTransaction(db, "user-1", "REWE", dining.Id, new DateOnly(2026, 6, 10));

        var tx = new Transaction { OwnerId = "user-1", Payee = "REWE", Date = new DateOnly(2026, 6, 20), Type = TransactionType.Expense };

        await AutoCategorizer.ApplyAsync(db, "user-1", new[] { tx }, CancellationToken.None);

        tx.BudgetItemId.Should().Be(dining.Id);
    }

    [Fact]
    public async Task Apply_FlipsTheInheritedLineToTracked()
    {
        await using var db = NewContext();
        var groceries = SeedMonthWithFood(db, "user-1", 2026, 6);
        groceries.ActualEntryMode = ActualEntryMode.Manual;
        await db.SaveChangesAsync();
        SeedAssignedTransaction(db, "user-1", "REWE", groceries.Id, new DateOnly(2026, 6, 1));

        var tx = new Transaction { OwnerId = "user-1", Payee = "REWE", Date = new DateOnly(2026, 6, 5), Type = TransactionType.Expense };
        await AutoCategorizer.ApplyAsync(db, "user-1", new[] { tx }, CancellationToken.None);
        await db.SaveChangesAsync();

        var reloaded = await db.BudgetItems.AsNoTracking().SingleAsync(i => i.Id == groceries.Id);
        reloaded.ActualEntryMode.Should().Be(ActualEntryMode.Tracked);
    }

    // --- Manual create integration ------------------------------------------

    [Fact]
    public async Task CreateTransaction_WithoutALine_InheritsFromTheMostRecentSameDescription()
    {
        await using var db = NewContext();
        var groceries = SeedMonthWithFood(db, "user-1", 2026, 6);
        SeedAssignedTransaction(db, "user-1", "REWE", groceries.Id, new DateOnly(2026, 6, 1));

        var handler = new CreateTransactionCommandHandler(db, new CurrentUserStub("user-1"));
        var dto = await handler.Handle(
            new CreateTransactionCommand(new DateOnly(2026, 6, 12), "REWE", 42.10m, TransactionType.Expense, BudgetItemId: null),
            CancellationToken.None);

        dto.BudgetItemId.Should().Be(groceries.Id);
        dto.BudgetItemName.Should().Be("Groceries"); // navigation hydrated for the response
    }

    [Fact]
    public async Task CreateTransaction_RespectsAnExplicitlyChosenLine_OverTheFallback()
    {
        await using var db = NewContext();
        var groceries = SeedMonthWithFood(db, "user-1", 2026, 6);
        var dining = new BudgetItem { Name = "Dining Out", BudgetCategoryId = groceries.BudgetCategoryId };
        db.BudgetItems.Add(dining);
        await db.SaveChangesAsync();
        SeedAssignedTransaction(db, "user-1", "REWE", groceries.Id, new DateOnly(2026, 6, 1));

        var handler = new CreateTransactionCommandHandler(db, new CurrentUserStub("user-1"));
        var dto = await handler.Handle(
            new CreateTransactionCommand(new DateOnly(2026, 6, 12), "REWE", 42.10m, TransactionType.Expense, BudgetItemId: dining.Id),
            CancellationToken.None);

        dto.BudgetItemId.Should().Be(dining.Id); // explicit choice wins
    }

    // --- Import integration --------------------------------------------------

    [Fact]
    public async Task Import_InheritsLineFromAPriorTransactionWithTheSameDescription()
    {
        await using var db = NewContext();
        // The CAMT.053 sample's rent entry: payee "Landlord GmbH", ref REF-RENT-001.
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
        SeedAssignedTransaction(db, "user-1", "Landlord GmbH", rent.Id, new DateOnly(2026, 5, 1));

        var handler = new ImportStatementCommandHandler(
            db, new CurrentUserStub("user-1"), new[] { new Camt053StatementParser() }, new FakeExchangeRateProvider());
        var result = await handler.Handle(new ImportStatementCommand(Camt053Samples.ThreeEntries), CancellationToken.None);

        result.Imported.Should().Be(3);
        result.AutoCategorized.Should().Be(1); // only the rent entry matched a prior description

        var rentTx = await db.Transactions.SingleAsync(t => t.BankReference == "REF-RENT-001");
        rentTx.BudgetItemId.Should().Be(rent.Id);
    }
}
