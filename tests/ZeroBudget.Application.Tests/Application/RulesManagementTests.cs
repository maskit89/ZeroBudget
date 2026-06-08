using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.Rules.Commands.DeleteCategorizationRule;
using ZeroBudget.Application.Rules.Commands.UpdateCategorizationRule;
using ZeroBudget.Application.Rules.Queries.GetCategorizationRules;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Infrastructure.Persistence;

namespace ZeroBudget.Application.Tests.Application;

/// <summary>
/// Managing the learned "payee → line" rules: list, re-point, delete — all owner-scoped.
/// </summary>
public class RulesManagementTests
{
    private sealed class CurrentUserStub(string? userId) : ICurrentUser
    {
        public string? UserId { get; } = userId;
    }

    private static ApplicationDbContext NewContext() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"zbb-rules-{Guid.NewGuid()}")
            .Options);

    private static CategorizationRule Seed(
        ApplicationDbContext db, string ownerId, string payee, string category, string item)
    {
        var rule = new CategorizationRule
        {
            OwnerId = ownerId,
            PayeeKey = CategorizationRule.NormalizeKey(payee),
            CategoryName = category,
            ItemName = item,
        };
        db.CategorizationRules.Add(rule);
        db.SaveChanges();
        return rule;
    }

    [Fact]
    public async Task Get_ReturnsOnlyTheUsersRules_OrderedByPayee()
    {
        await using var db = NewContext();
        Seed(db, "user-1", "Tesco", "Food", "Groceries");
        Seed(db, "user-1", "Aldi", "Food", "Groceries");
        Seed(db, "user-2", "Shell", "Transport", "Fuel");

        var handler = new GetCategorizationRulesQueryHandler(db, new CurrentUserStub("user-1"));
        var rules = await handler.Handle(new GetCategorizationRulesQuery(), CancellationToken.None);

        rules.Should().HaveCount(2);
        rules.Select(r => r.Payee).Should().Equal("aldi", "tesco"); // alphabetical, normalized
    }

    [Fact]
    public async Task Update_RepointsTheRuleToANewLine()
    {
        await using var db = NewContext();
        var rule = Seed(db, "user-1", "Tesco", "Food", "Groceries");

        var handler = new UpdateCategorizationRuleCommandHandler(db, new CurrentUserStub("user-1"));
        var dto = await handler.Handle(
            new UpdateCategorizationRuleCommand(rule.Id, "Household", "Cleaning"), CancellationToken.None);

        dto.CategoryName.Should().Be("Household");
        dto.ItemName.Should().Be("Cleaning");
        dto.Payee.Should().Be("tesco"); // key unchanged

        var reloaded = await db.CategorizationRules.FindAsync(rule.Id);
        reloaded!.CategoryName.Should().Be("Household");
    }

    [Fact]
    public async Task Update_Throws_WhenNotOwned()
    {
        await using var db = NewContext();
        var rule = Seed(db, "user-1", "Tesco", "Food", "Groceries");

        var handler = new UpdateCategorizationRuleCommandHandler(db, new CurrentUserStub("attacker"));
        var act = () => handler.Handle(
            new UpdateCategorizationRuleCommand(rule.Id, "x", "y"), CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenAccessException>();
    }

    [Fact]
    public async Task Update_Throws_WhenNotFound()
    {
        await using var db = NewContext();
        var handler = new UpdateCategorizationRuleCommandHandler(db, new CurrentUserStub("user-1"));

        var act = () => handler.Handle(
            new UpdateCategorizationRuleCommand(Guid.NewGuid(), "x", "y"), CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Delete_RemovesTheRule()
    {
        await using var db = NewContext();
        var rule = Seed(db, "user-1", "Tesco", "Food", "Groceries");

        var handler = new DeleteCategorizationRuleCommandHandler(db, new CurrentUserStub("user-1"));
        await handler.Handle(new DeleteCategorizationRuleCommand(rule.Id), CancellationToken.None);

        (await db.CategorizationRules.FindAsync(rule.Id)).Should().BeNull();
    }

    [Fact]
    public async Task Delete_Throws_WhenNotOwned()
    {
        await using var db = NewContext();
        var rule = Seed(db, "user-1", "Tesco", "Food", "Groceries");

        var handler = new DeleteCategorizationRuleCommandHandler(db, new CurrentUserStub("attacker"));
        var act = () => handler.Handle(new DeleteCategorizationRuleCommand(rule.Id), CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenAccessException>();
        (await db.CategorizationRules.FindAsync(rule.Id)).Should().NotBeNull(); // untouched
    }

    [Theory]
    [InlineData("", "Groceries", false)]
    [InlineData("Food", "", false)]
    [InlineData("Food", "Groceries", true)]
    public void Validator_RequiresBothNames(string category, string item, bool expectedValid)
    {
        var validator = new UpdateCategorizationRuleCommandValidator();
        validator
            .Validate(new UpdateCategorizationRuleCommand(Guid.NewGuid(), category, item))
            .IsValid.Should().Be(expectedValid);
    }
}
