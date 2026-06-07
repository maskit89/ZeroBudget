using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using ZeroBudget.Application.Budgets.Queries.GetBudgetMonth;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.Transactions.Commands.AssignTransaction;
using ZeroBudget.Application.Transactions.Commands.CreateTransaction;
using ZeroBudget.Application.Transactions.Commands.DeleteTransaction;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;
using ZeroBudget.Infrastructure.Persistence;

namespace ZeroBudget.Application.Tests.Transactions;

/// <summary>
/// Manually created/deleted transactions, and the rule that assigning a
/// transaction to a line switches that line to transaction tracking.
/// </summary>
public class ManualTransactionTests
{
    private sealed class CurrentUserStub(string? userId) : ICurrentUser
    {
        public string? UserId { get; } = userId;
    }

    private static ApplicationDbContext NewContext() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"zbb-{Guid.NewGuid()}")
            .Options);

    // Income(3000) + Housing(Rent planned 1000). Returns the Rent line id.
    private static Guid Seed(ApplicationDbContext db, string ownerId)
    {
        var rent = new BudgetItem { Name = "Rent", PlannedAmount = 1000m };
        db.BudgetMonths.Add(new BudgetMonth
        {
            OwnerId = ownerId,
            Year = 2026,
            Month = 6,
            Categories = new List<BudgetCategory>
            {
                new() { Name = "Housing", Items = new List<BudgetItem> { rent } },
            },
        });
        db.SaveChanges();
        return rent.Id;
    }

    [Fact]
    public async Task Create_Assigned_AddsTransactionAndTracksTheLine()
    {
        await using var db = NewContext();
        var rentId = Seed(db, "user-1");
        var user = new CurrentUserStub("user-1");

        var dto = await new CreateTransactionCommandHandler(db, user).Handle(
            new CreateTransactionCommand(
                new DateOnly(2026, 6, 15), "Landlord", 750m, TransactionType.Expense, rentId),
            CancellationToken.None);

        dto.Payee.Should().Be("Landlord");
        dto.Amount.Should().Be(750m);
        dto.BudgetItemId.Should().Be(rentId);

        // The line now tracks transactions and rolls the 750 up as its spent.
        var month = await new GetBudgetMonthQueryHandler(db, user)
            .Handle(new GetBudgetMonthQuery(2026, 6), CancellationToken.None);
        var rent = month.Categories.SelectMany(c => c.Items).Single(i => i.Id == rentId);
        rent.IsActualTracked.Should().BeTrue();
        rent.ActualAmount.Should().Be(750m);
    }

    [Fact]
    public async Task Create_Unassigned_AddsAStandaloneTransaction()
    {
        await using var db = NewContext();
        Seed(db, "user-1");
        var user = new CurrentUserStub("user-1");

        var dto = await new CreateTransactionCommandHandler(db, user).Handle(
            new CreateTransactionCommand(
                new DateOnly(2026, 6, 1), "Cash", 20m, TransactionType.Expense, null),
            CancellationToken.None);

        dto.BudgetItemId.Should().BeNull();
        (await db.Transactions.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task Create_Throws_WhenAssigningToAnotherUsersLine()
    {
        await using var db = NewContext();
        var rentId = Seed(db, "user-1");
        var handler = new CreateTransactionCommandHandler(db, new CurrentUserStub("attacker"));

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            handler.Handle(
                new CreateTransactionCommand(
                    new DateOnly(2026, 6, 1), "x", 10m, TransactionType.Expense, rentId),
                CancellationToken.None));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public void Validator_RejectsNonPositiveAmount(decimal amount)
    {
        var validator = new CreateTransactionCommandValidator();
        var result = validator.Validate(new CreateTransactionCommand(
            new DateOnly(2026, 6, 1), "x", amount, TransactionType.Expense, null));
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public async Task Assign_SwitchesAManualLineToTracked()
    {
        await using var db = NewContext();
        var rentId = Seed(db, "user-1");
        var user = new CurrentUserStub("user-1");

        // A standalone transaction, then assigned to the (manual) Rent line.
        var tx = new Transaction
        {
            OwnerId = "user-1",
            Date = new DateOnly(2026, 6, 10),
            Payee = "Landlord",
            Amount = 300m,
            Type = TransactionType.Expense,
        };
        db.Transactions.Add(tx);
        await db.SaveChangesAsync();

        await new AssignTransactionCommandHandler(db, user)
            .Handle(new AssignTransactionCommand(tx.Id, rentId), CancellationToken.None);

        var month = await new GetBudgetMonthQueryHandler(db, user)
            .Handle(new GetBudgetMonthQuery(2026, 6), CancellationToken.None);
        var rent = month.Categories.SelectMany(c => c.Items).Single(i => i.Id == rentId);
        rent.IsActualTracked.Should().BeTrue();
        rent.ActualAmount.Should().Be(300m);
    }

    [Fact]
    public async Task Delete_RemovesTheTransaction()
    {
        await using var db = NewContext();
        Seed(db, "user-1");
        var user = new CurrentUserStub("user-1");
        var tx = new Transaction { OwnerId = "user-1", Amount = 10m, Type = TransactionType.Expense };
        db.Transactions.Add(tx);
        await db.SaveChangesAsync();

        await new DeleteTransactionCommandHandler(db, user)
            .Handle(new DeleteTransactionCommand(tx.Id), CancellationToken.None);

        (await db.Transactions.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Delete_Throws_WhenUserDoesNotOwnTheTransaction()
    {
        await using var db = NewContext();
        Seed(db, "user-1");
        var tx = new Transaction { OwnerId = "user-1", Amount = 10m, Type = TransactionType.Expense };
        db.Transactions.Add(tx);
        await db.SaveChangesAsync();

        var handler = new DeleteTransactionCommandHandler(db, new CurrentUserStub("attacker"));

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            handler.Handle(new DeleteTransactionCommand(tx.Id), CancellationToken.None));
    }
}
