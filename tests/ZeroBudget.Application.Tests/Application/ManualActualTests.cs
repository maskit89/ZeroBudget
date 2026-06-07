using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using ZeroBudget.Application.Budgets.Commands.SetBudgetItemActual;
using ZeroBudget.Application.Budgets.Queries.GetBudgetMonth;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;
using ZeroBudget.Infrastructure.Persistence;

namespace ZeroBudget.Application.Tests.Application;

/// <summary>
/// Manual actuals: a line with no transactions takes the user's typed value;
/// a line with transactions ignores it (transactions drive the displayed spent).
/// </summary>
public class ManualActualTests
{
    private sealed class CurrentUserStub : ICurrentUser
    {
        public CurrentUserStub(string? userId) => UserId = userId;
        public string? UserId { get; }
    }

    private static ApplicationDbContext NewContext() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"zbb-{Guid.NewGuid()}")
            .Options);

    // Income(3000) + Housing(Rent planned 1000). Returns the Rent line id.
    private static (Guid monthId, Guid rentId) Seed(ApplicationDbContext db, string ownerId)
    {
        var rent = new BudgetItem { Name = "Rent", PlannedAmount = 1000m };
        var month = new BudgetMonth
        {
            OwnerId = ownerId,
            Year = 2026,
            Month = 6,
            Categories = new List<BudgetCategory>
            {
                new()
                {
                    Name = "Income",
                    Kind = CategoryKind.Income,
                    Items = new List<BudgetItem> { new() { Name = "Pay", PlannedAmount = 3000m } },
                },
                new() { Name = "Housing", Items = new List<BudgetItem> { rent } },
            },
        };
        db.BudgetMonths.Add(month);
        db.SaveChanges();
        return (month.Id, rent.Id);
    }

    [Fact]
    public async Task Set_StoresManualValue_WhenLineHasNoTransactions()
    {
        await using var db = NewContext();
        var (_, rentId) = Seed(db, "user-1");
        var handler = new SetBudgetItemActualCommandHandler(db, new CurrentUserStub("user-1"));

        var result = await handler.Handle(
            new SetBudgetItemActualCommand(rentId, 250m), CancellationToken.None);

        var rent = result.Categories.SelectMany(c => c.Items).Single(i => i.Id == rentId);
        rent.ActualAmount.Should().Be(250m);
        rent.IsActualTracked.Should().BeFalse(); // manual, so the UI keeps it editable
        rent.Remaining.Should().Be(750m);        // 1000 planned - 250 spent
    }

    [Fact]
    public async Task TransactionsWin_OverManualValue_WhenBothPresent()
    {
        await using var db = NewContext();
        var (_, rentId) = Seed(db, "user-1");

        // The user typed a manual estimate AND has a real transaction on the line.
        await new SetBudgetItemActualCommandHandler(db, new CurrentUserStub("user-1"))
            .Handle(new SetBudgetItemActualCommand(rentId, 999m), CancellationToken.None);
        db.Transactions.Add(new Transaction
        {
            OwnerId = "user-1",
            BudgetItemId = rentId,
            Amount = 300m,
            Type = TransactionType.Expense,
        });
        await db.SaveChangesAsync();

        var dto = await new GetBudgetMonthQueryHandler(db, new CurrentUserStub("user-1"))
            .Handle(new GetBudgetMonthQuery(2026, 6), CancellationToken.None);

        var rent = dto.Categories.SelectMany(c => c.Items).Single(i => i.Id == rentId);
        rent.ActualAmount.Should().Be(300m);  // the transaction, not the 999 estimate
        rent.IsActualTracked.Should().BeTrue();
    }

    [Fact]
    public async Task ManualValue_IsUsed_WhenLineHasNoTransactions_OnRead()
    {
        await using var db = NewContext();
        var (_, rentId) = Seed(db, "user-1");
        await new SetBudgetItemActualCommandHandler(db, new CurrentUserStub("user-1"))
            .Handle(new SetBudgetItemActualCommand(rentId, 425m), CancellationToken.None);

        var dto = await new GetBudgetMonthQueryHandler(db, new CurrentUserStub("user-1"))
            .Handle(new GetBudgetMonthQuery(2026, 6), CancellationToken.None);

        var rent = dto.Categories.SelectMany(c => c.Items).Single(i => i.Id == rentId);
        rent.ActualAmount.Should().Be(425m);
        rent.IsActualTracked.Should().BeFalse();
    }

    [Fact]
    public async Task Set_Throws_WhenUserDoesNotOwnTheItem()
    {
        await using var db = NewContext();
        var (_, rentId) = Seed(db, "user-1");
        var handler = new SetBudgetItemActualCommandHandler(db, new CurrentUserStub("attacker"));

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            handler.Handle(new SetBudgetItemActualCommand(rentId, 50m), CancellationToken.None));
    }

    [Fact]
    public async Task Set_Throws_WhenItemDoesNotExist()
    {
        await using var db = NewContext();
        Seed(db, "user-1");
        var handler = new SetBudgetItemActualCommandHandler(db, new CurrentUserStub("user-1"));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(new SetBudgetItemActualCommand(Guid.NewGuid(), 50m), CancellationToken.None));
    }

    [Fact]
    public void Validator_RejectsNegativeAmount()
    {
        var validator = new SetBudgetItemActualCommandValidator();
        validator.Validate(new SetBudgetItemActualCommand(Guid.NewGuid(), -1m)).IsValid.Should().BeFalse();
    }
}
