using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using ZeroBudget.Application.Budgets.Queries.GetBudgetLineOptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;
using ZeroBudget.Domain.ValueObjects;
using ZeroBudget.Infrastructure.Persistence;

namespace ZeroBudget.Application.Tests.Application;

/// <summary>
/// The line-options lookup that powers the rules name-picker: distinct category and
/// line names across all of the user's budgets, merged case-insensitively, owner-scoped.
/// </summary>
public class BudgetLineOptionsTests
{
    private sealed class CurrentUserStub(string? userId) : ICurrentUser
    {
        public string? UserId { get; } = userId;
    }

    private static ApplicationDbContext NewContext() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"zbb-lineopts-{Guid.NewGuid()}")
            .Options);

    private static void SeedMonth(
        ApplicationDbContext db, string ownerId, int year, int month, params (string Category, string[] Lines)[] groups)
    {
        db.BudgetMonths.Add(new BudgetMonth
        {
            OwnerId = ownerId,
            Year = year,
            Month = month,
            BaseCurrency = CurrencyCode.Eur,
            Categories = groups.Select(g => new BudgetCategory
            {
                Name = g.Category,
                Kind = g.Category == "Income" ? CategoryKind.Income : CategoryKind.Expense,
                Items = g.Lines.Select(l => new BudgetItem { Name = l }).ToList(),
            }).ToList(),
        });
        db.SaveChanges();
    }

    [Fact]
    public async Task LineOptions_MergeDistinctNamesAcrossMonths_Alphabetically()
    {
        await using var db = NewContext();
        SeedMonth(db, "user-1", 2026, 5,
            ("Income", new[] { "Salary" }),
            ("Housing", new[] { "Rent", "Insurance" }));
        SeedMonth(db, "user-1", 2026, 6,
            ("Housing", new[] { "Rent" }),       // duplicate line — merged
            ("Food", new[] { "Groceries" }));

        var handler = new GetBudgetLineOptionsQueryHandler(db, new CurrentUserStub("user-1"));
        var options = await handler.Handle(new GetBudgetLineOptionsQuery(), CancellationToken.None);

        options.Select(o => o.CategoryName).Should().Equal("Food", "Housing", "Income");
        options.Single(o => o.CategoryName == "Housing").ItemNames.Should().Equal("Insurance", "Rent");
        options.Single(o => o.CategoryName == "Food").ItemNames.Should().Equal("Groceries");
    }

    [Fact]
    public async Task LineOptions_DedupeCaseInsensitively()
    {
        await using var db = NewContext();
        SeedMonth(db, "user-1", 2026, 5, ("Housing", new[] { "Rent" }));
        SeedMonth(db, "user-1", 2026, 6, ("housing", new[] { "RENT" }));

        var handler = new GetBudgetLineOptionsQueryHandler(db, new CurrentUserStub("user-1"));
        var options = await handler.Handle(new GetBudgetLineOptionsQuery(), CancellationToken.None);

        options.Should().ContainSingle();
        options[0].ItemNames.Should().ContainSingle();
    }

    [Fact]
    public async Task LineOptions_AreOwnerScoped()
    {
        await using var db = NewContext();
        SeedMonth(db, "user-1", 2026, 6, ("Food", new[] { "Groceries" }));
        SeedMonth(db, "user-2", 2026, 6, ("Secret", new[] { "Hidden" }));

        var handler = new GetBudgetLineOptionsQueryHandler(db, new CurrentUserStub("user-1"));
        var options = await handler.Handle(new GetBudgetLineOptionsQuery(), CancellationToken.None);

        options.Should().ContainSingle(o => o.CategoryName == "Food");
        options.Should().NotContain(o => o.CategoryName == "Secret");
    }
}
