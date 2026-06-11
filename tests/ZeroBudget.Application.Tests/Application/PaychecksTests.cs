using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using ZeroBudget.Application.Budgets.Commands.DeleteBudgetItem;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.Paychecks.Commands.CreatePaycheck;
using ZeroBudget.Application.Paychecks.Commands.DeletePaycheck;
using ZeroBudget.Application.Paychecks.Commands.SetPaycheckAllocations;
using ZeroBudget.Application.Paychecks.Queries.GetPaychecks;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;
using ZeroBudget.Domain.ValueObjects;
using ZeroBudget.Infrastructure.Persistence;

namespace ZeroBudget.Application.Tests.Application;

/// <summary>
/// Paycheck planning: paychecks belong to a month and spread their amount across the
/// month's expense/fund lines via allocations; owner-scoped throughout.
/// </summary>
public class PaychecksTests
{
    private sealed class CurrentUserStub(string? userId) : ICurrentUser
    {
        public string? UserId { get; } = userId;
    }

    private static ApplicationDbContext NewContext() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"zbb-paychecks-{Guid.NewGuid()}")
            .Options);

    /// <summary>A month with an income line "Salary" and two expense lines "Rent"/"Food".</summary>
    private static BudgetMonth SeedMonth(ApplicationDbContext db, string ownerId, int year = 2026, int month = 6)
    {
        var m = new BudgetMonth
        {
            OwnerId = ownerId,
            Year = year,
            Month = month,
            BaseCurrency = CurrencyCode.Eur,
            Categories = new List<BudgetCategory>
            {
                new()
                {
                    Name = "Income", Kind = CategoryKind.Income,
                    Items = new List<BudgetItem> { new() { Name = "Salary", PlannedAmount = 2000m } },
                },
                new()
                {
                    Name = "Housing", Kind = CategoryKind.Expense,
                    Items = new List<BudgetItem>
                    {
                        new() { Name = "Rent", PlannedAmount = 1000m },
                        new() { Name = "Food", PlannedAmount = 400m },
                    },
                },
            },
        };
        db.BudgetMonths.Add(m);
        db.SaveChanges();
        return m;
    }

    private static BudgetItem Line(BudgetMonth m, string name) =>
        m.Categories.SelectMany(c => c.Items).Single(i => i.Name == name);

    [Fact]
    public async Task Create_AddsPaycheck_OrderedAfterExisting()
    {
        await using var db = NewContext();
        var month = SeedMonth(db, "user-1");
        var handler = new CreatePaycheckCommandHandler(db, new CurrentUserStub("user-1"));

        var first = await handler.Handle(
            new CreatePaycheckCommand(month.Id, "1st", new DateOnly(2026, 6, 1), 1500m), CancellationToken.None);
        var second = await handler.Handle(
            new CreatePaycheckCommand(month.Id, "15th", new DateOnly(2026, 6, 15), 500m), CancellationToken.None);

        first.DisplayOrder.Should().Be(0);
        second.DisplayOrder.Should().Be(1);
        second.Remaining.Should().Be(500m); // nothing allocated yet
    }

    [Fact]
    public async Task Get_ReturnsTheMonthsPaychecks_OwnerScoped()
    {
        await using var db = NewContext();
        var mine = SeedMonth(db, "user-1");
        var theirs = SeedMonth(db, "user-2");
        await new CreatePaycheckCommandHandler(db, new CurrentUserStub("user-1"))
            .Handle(new CreatePaycheckCommand(mine.Id, "Mine", new DateOnly(2026, 6, 1), 100m), CancellationToken.None);
        await new CreatePaycheckCommandHandler(db, new CurrentUserStub("user-2"))
            .Handle(new CreatePaycheckCommand(theirs.Id, "Theirs", new DateOnly(2026, 6, 1), 100m), CancellationToken.None);

        var result = await new GetPaychecksQueryHandler(db, new CurrentUserStub("user-1"))
            .Handle(new GetPaychecksQuery(2026, 6), CancellationToken.None);

        result.Should().ContainSingle(p => p.Name == "Mine");
    }

    [Fact]
    public async Task SetAllocations_ReplacesThem_AndDerivesRemaining()
    {
        await using var db = NewContext();
        var month = SeedMonth(db, "user-1");
        var paycheck = await new CreatePaycheckCommandHandler(db, new CurrentUserStub("user-1"))
            .Handle(new CreatePaycheckCommand(month.Id, "1st", new DateOnly(2026, 6, 1), 1500m), CancellationToken.None);

        var handler = new SetPaycheckAllocationsCommandHandler(db, new CurrentUserStub("user-1"));
        var dto = await handler.Handle(
            new SetPaycheckAllocationsCommand(paycheck.Id, new[]
            {
                new PaycheckAllocationInput(Line(month, "Rent").Id, 1000m),
                new PaycheckAllocationInput(Line(month, "Food").Id, 300m),
            }),
            CancellationToken.None);

        dto.Allocations.Should().HaveCount(2);
        dto.AllocatedAmount.Should().Be(1300m);
        dto.Remaining.Should().Be(200m); // 1500 − 1300

        // Replacing wholesale leaves only the new set.
        var replaced = await handler.Handle(
            new SetPaycheckAllocationsCommand(paycheck.Id, new[]
            {
                new PaycheckAllocationInput(Line(month, "Rent").Id, 500m),
            }),
            CancellationToken.None);

        replaced.Allocations.Should().ContainSingle();
        replaced.AllocatedAmount.Should().Be(500m);
        (await db.PaycheckAllocations.CountAsync()).Should().Be(1); // old rows gone
    }

    [Fact]
    public async Task SetAllocations_RejectsAnIncomeLine()
    {
        await using var db = NewContext();
        var month = SeedMonth(db, "user-1");
        var paycheck = await new CreatePaycheckCommandHandler(db, new CurrentUserStub("user-1"))
            .Handle(new CreatePaycheckCommand(month.Id, "1st", new DateOnly(2026, 6, 1), 1500m), CancellationToken.None);

        var handler = new SetPaycheckAllocationsCommandHandler(db, new CurrentUserStub("user-1"));
        var act = () => handler.Handle(
            new SetPaycheckAllocationsCommand(paycheck.Id, new[]
            {
                new PaycheckAllocationInput(Line(month, "Salary").Id, 100m),
            }),
            CancellationToken.None);

        await act.Should().ThrowAsync<ValidationException>();
    }

    [Fact]
    public async Task DeletePaycheck_RemovesItsAllocations()
    {
        await using var db = NewContext();
        var month = SeedMonth(db, "user-1");
        var paycheck = await new CreatePaycheckCommandHandler(db, new CurrentUserStub("user-1"))
            .Handle(new CreatePaycheckCommand(month.Id, "1st", new DateOnly(2026, 6, 1), 1500m), CancellationToken.None);
        await new SetPaycheckAllocationsCommandHandler(db, new CurrentUserStub("user-1")).Handle(
            new SetPaycheckAllocationsCommand(paycheck.Id, new[]
            {
                new PaycheckAllocationInput(Line(month, "Rent").Id, 1000m),
            }),
            CancellationToken.None);

        await new DeletePaycheckCommandHandler(db, new CurrentUserStub("user-1"))
            .Handle(new DeletePaycheckCommand(paycheck.Id), CancellationToken.None);

        (await db.Paychecks.CountAsync()).Should().Be(0);
        (await db.PaycheckAllocations.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task DeletingABudgetLine_AlsoRemovesItsPaycheckAllocations()
    {
        await using var db = NewContext();
        var month = SeedMonth(db, "user-1");
        var paycheck = await new CreatePaycheckCommandHandler(db, new CurrentUserStub("user-1"))
            .Handle(new CreatePaycheckCommand(month.Id, "1st", new DateOnly(2026, 6, 1), 1500m), CancellationToken.None);
        var rent = Line(month, "Rent");
        await new SetPaycheckAllocationsCommandHandler(db, new CurrentUserStub("user-1")).Handle(
            new SetPaycheckAllocationsCommand(paycheck.Id, new[] { new PaycheckAllocationInput(rent.Id, 1000m) }),
            CancellationToken.None);

        await new DeleteBudgetItemCommandHandler(db, new CurrentUserStub("user-1"))
            .Handle(new DeleteBudgetItemCommand(rent.Id), CancellationToken.None);

        (await db.PaycheckAllocations.CountAsync()).Should().Be(0); // cleaned up, delete not blocked
        (await db.Paychecks.CountAsync()).Should().Be(1);           // the paycheck itself survives
    }
}
