using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using ZeroBudget.Application.Budgets.Commands.CreateBudgetMonth;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.SinkingFunds.Commands.ArchiveSinkingFund;
using ZeroBudget.Application.SinkingFunds.Commands.CreateSinkingFund;
using ZeroBudget.Application.SinkingFunds.Commands.UpdateSinkingFund;
using ZeroBudget.Application.SinkingFunds.Queries.GetSinkingFunds;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;
using ZeroBudget.Domain.ValueObjects;
using ZeroBudget.Infrastructure.Persistence;

namespace ZeroBudget.Application.Tests.Application;

/// <summary>
/// Sinking-fund management: definitions (target/date/accrual), the read-time-derived
/// balance/required/status, and seeding a new month's contribution from the accrual
/// calculator.
/// </summary>
public class SinkingFundsTests
{
    private sealed class CurrentUserStub(string? userId) : ICurrentUser
    {
        public string? UserId { get; } = userId;
    }

    private static ApplicationDbContext NewContext() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"zbb-funds2-{Guid.NewGuid()}")
            .Options);

    private static SinkingFund SeedFund(
        ApplicationDbContext db, string ownerId, Guid id, decimal target,
        AccrualMethod accrual = AccrualMethod.TargetByDate, DateOnly? targetDate = null,
        decimal opening = 0m, bool archived = false)
    {
        var fund = new SinkingFund
        {
            Id = id,
            OwnerId = ownerId,
            Name = "Holiday",
            Kind = FundKind.Annual,
            TargetAmount = target,
            Accrual = accrual,
            TargetDate = targetDate,
            OpeningBalance = opening,
            IsArchived = archived,
        };
        db.SinkingFunds.Add(fund);
        db.SaveChanges();
        return fund;
    }

    // Seeds a Fund-group budget line for a fund, optionally with a tracked spend.
    private static BudgetItem SeedFundLine(
        ApplicationDbContext db, string ownerId, Guid fundId, int year, int month,
        decimal planned, decimal spent = 0m)
    {
        var line = new BudgetItem
        {
            Name = "Holiday",
            FundId = fundId,
            PlannedAmount = planned,
        };
        db.BudgetMonths.Add(new BudgetMonth
        {
            OwnerId = ownerId,
            Year = year,
            Month = month,
            BaseCurrency = CurrencyCode.Eur,
            Categories = new List<BudgetCategory>
            {
                new() { Name = "Funds", Kind = CategoryKind.Fund, Items = new List<BudgetItem> { line } },
            },
        });
        db.SaveChanges();

        if (spent > 0m)
        {
            db.Transactions.Add(new Transaction
            {
                OwnerId = ownerId,
                BudgetItemId = line.Id,
                Amount = spent,
                Type = TransactionType.Expense,
                Date = new DateOnly(year, month, 15),
            });
            db.SaveChanges();
        }

        return line;
    }

    [Fact]
    public async Task Create_PersistsOwnerAndFields()
    {
        await using var db = NewContext();
        var handler = new CreateSinkingFundCommandHandler(db, new CurrentUserStub("user-1"));

        var dto = await handler.Handle(new CreateSinkingFundCommand(
            "Home Insurance", FundKind.Commitment, 300m, null, null, null,
            AccrualMethod.StraightLine, RecurAnnually: true, OpeningBalance: 0m,
            OpeningAsOf: null, FundingAccountId: null), CancellationToken.None);

        dto.Name.Should().Be("Home Insurance");
        dto.RequiredMonthlyContribution.Should().Be(25.00m);   // 300 / 12
        dto.CurrentBalance.Should().Be(0m);

        var stored = await db.SinkingFunds.SingleAsync();
        stored.OwnerId.Should().Be("user-1");
        stored.RecurAnnually.Should().BeTrue();
    }

    [Fact]
    public async Task Get_IsOwnerScoped_AndExcludesArchivedByDefault()
    {
        await using var db = NewContext();
        SeedFund(db, "user-1", Guid.NewGuid(), 300m);
        SeedFund(db, "user-1", Guid.NewGuid(), 300m, archived: true);
        SeedFund(db, "user-2", Guid.NewGuid(), 300m);

        var handler = new GetSinkingFundsQueryHandler(db, new CurrentUserStub("user-1"));

        var active = await handler.Handle(new GetSinkingFundsQuery(), CancellationToken.None);
        active.Should().ContainSingle().Which.IsArchived.Should().BeFalse();

        var all = await handler.Handle(new GetSinkingFundsQuery(IncludeArchived: true), CancellationToken.None);
        all.Should().HaveCount(2);
    }

    [Fact]
    public async Task Get_DerivesBalance_OpeningPlusContributionsMinusSpend()
    {
        await using var db = NewContext();
        var fundId = Guid.NewGuid();
        SeedFund(db, "user-1", fundId, target: 1000m, opening: 50m);
        SeedFundLine(db, "user-1", fundId, 2026, 6, planned: 100m, spent: 30m);

        var handler = new GetSinkingFundsQueryHandler(db, new CurrentUserStub("user-1"));
        var funds = await handler.Handle(new GetSinkingFundsQuery(), CancellationToken.None);

        funds.Single().CurrentBalance.Should().Be(120m); // 50 + 100 − 30
    }

    [Fact]
    public async Task Get_ComputesRequiredContribution_TargetByDate_Deterministically()
    {
        await using var db = NewContext();
        var fundId = Guid.NewGuid();
        SeedFund(db, "user-1", fundId, target: 1200m,
            accrual: AccrualMethod.TargetByDate, targetDate: new DateOnly(2026, 11, 1), opening: 200m);

        var handler = new GetSinkingFundsQueryHandler(db, new CurrentUserStub("user-1"));
        var funds = await handler.Handle(
            new GetSinkingFundsQuery(AsOf: new DateOnly(2026, 1, 1)), CancellationToken.None);

        // (1200 − 200) / 10 months = 100.00
        funds.Single().RequiredMonthlyContribution.Should().Be(100.00m);
    }

    [Fact]
    public async Task Get_Status_IsFullyFunded_WhenBalanceMeetsTarget()
    {
        await using var db = NewContext();
        SeedFund(db, "user-1", Guid.NewGuid(), target: 100m, opening: 100m);

        var funds = await new GetSinkingFundsQueryHandler(db, new CurrentUserStub("user-1"))
            .Handle(new GetSinkingFundsQuery(), CancellationToken.None);

        funds.Single().Status.Should().Be("FullyFunded");
    }

    [Fact]
    public async Task Get_Status_IsOverspent_WhenBalanceGoesNegative()
    {
        await using var db = NewContext();
        var fundId = Guid.NewGuid();
        SeedFund(db, "user-1", fundId, target: 100m, opening: 0m);
        SeedFundLine(db, "user-1", fundId, 2026, 6, planned: 10m, spent: 50m); // 0 + 10 − 50 = −40

        var funds = await new GetSinkingFundsQueryHandler(db, new CurrentUserStub("user-1"))
            .Handle(new GetSinkingFundsQuery(), CancellationToken.None);

        funds.Single().Status.Should().Be("Overspent");
    }

    [Fact]
    public async Task Update_EditsFields()
    {
        await using var db = NewContext();
        var fundId = Guid.NewGuid();
        SeedFund(db, "user-1", fundId, target: 300m);

        var dto = await new UpdateSinkingFundCommandHandler(db, new CurrentUserStub("user-1"))
            .Handle(new UpdateSinkingFundCommand(
                fundId, "Renamed", FundKind.Goal, 500m, null, null, null,
                AccrualMethod.StraightLine, false, 0m, null, null), CancellationToken.None);

        dto.Name.Should().Be("Renamed");
        dto.TargetAmount.Should().Be(500m);
        dto.RequiredMonthlyContribution.Should().Be(41.67m); // 500 / 12
    }

    [Fact]
    public async Task Update_Throws_WhenMissing()
    {
        await using var db = NewContext();
        var handler = new UpdateSinkingFundCommandHandler(db, new CurrentUserStub("user-1"));

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(
            new UpdateSinkingFundCommand(Guid.NewGuid(), "X", FundKind.Annual, 1m, null, null, null,
                AccrualMethod.TargetByDate, false, 0m, null, null), CancellationToken.None));
    }

    [Fact]
    public async Task Update_Throws_WhenOwnedByAnotherUser()
    {
        await using var db = NewContext();
        var fundId = Guid.NewGuid();
        SeedFund(db, "user-1", fundId, target: 300m);

        var handler = new UpdateSinkingFundCommandHandler(db, new CurrentUserStub("user-2"));

        await Assert.ThrowsAsync<ForbiddenAccessException>(() => handler.Handle(
            new UpdateSinkingFundCommand(fundId, "X", FundKind.Annual, 1m, null, null, null,
                AccrualMethod.TargetByDate, false, 0m, null, null), CancellationToken.None));
    }

    [Fact]
    public async Task Archive_HidesFromDefaultList()
    {
        await using var db = NewContext();
        var fundId = Guid.NewGuid();
        SeedFund(db, "user-1", fundId, target: 300m);

        await new ArchiveSinkingFundCommandHandler(db, new CurrentUserStub("user-1"))
            .Handle(new ArchiveSinkingFundCommand(fundId), CancellationToken.None);

        var active = await new GetSinkingFundsQueryHandler(db, new CurrentUserStub("user-1"))
            .Handle(new GetSinkingFundsQuery(), CancellationToken.None);
        active.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateBudgetMonth_SeedsFundContribution_FromAccrual_WhenFundHasTarget()
    {
        await using var db = NewContext();
        var fundId = Guid.NewGuid();
        // Target 1200 by 1 Dec, nothing accrued yet beyond May's 200 contribution.
        SeedFund(db, "user-1", fundId, target: 1200m,
            accrual: AccrualMethod.TargetByDate, targetDate: new DateOnly(2026, 12, 1));
        SeedFundLine(db, "user-1", fundId, 2026, 5, planned: 200m); // May contribution

        await new CreateBudgetMonthCommandHandler(db, new CurrentUserStub("user-1"))
            .Handle(new CreateBudgetMonthCommand(2026, 6, CopyFromPrevious: true), CancellationToken.None);

        var juneLine = await db.BudgetItems
            .Include(i => i.BudgetCategory).ThenInclude(c => c.BudgetMonth)
            .SingleAsync(i => i.FundId == fundId && i.BudgetCategory.BudgetMonth.Month == 6);

        // Balance entering June = 200; remaining 1000 over 6 months (Jun→Dec) = 166.67.
        juneLine.PlannedAmount.Should().Be(166.67m);
    }

    [Fact]
    public async Task CreateBudgetMonth_KeepsCopiedAmount_WhenFundHasNoTarget()
    {
        await using var db = NewContext();
        var fundId = Guid.NewGuid();
        SeedFund(db, "user-1", fundId, target: 0m); // unconfigured target → not seeded
        SeedFundLine(db, "user-1", fundId, 2026, 5, planned: 200m);

        await new CreateBudgetMonthCommandHandler(db, new CurrentUserStub("user-1"))
            .Handle(new CreateBudgetMonthCommand(2026, 6, CopyFromPrevious: true), CancellationToken.None);

        var juneLine = await db.BudgetItems
            .Include(i => i.BudgetCategory).ThenInclude(c => c.BudgetMonth)
            .SingleAsync(i => i.FundId == fundId && i.BudgetCategory.BudgetMonth.Month == 6);

        juneLine.PlannedAmount.Should().Be(200m); // copied, not recomputed
    }

    [Fact]
    public void Validator_RejectsEmptyName_NegativeTarget_AndBadCoverWindow()
    {
        var validator = new CreateSinkingFundCommandValidator();

        validator.Validate(new CreateSinkingFundCommand(
            "", FundKind.Annual, 100m, null, null, null,
            AccrualMethod.TargetByDate, false, 0m, null, null)).IsValid.Should().BeFalse();

        validator.Validate(new CreateSinkingFundCommand(
            "X", FundKind.Annual, -1m, null, null, null,
            AccrualMethod.TargetByDate, false, 0m, null, null)).IsValid.Should().BeFalse();

        validator.Validate(new CreateSinkingFundCommand(
            "X", FundKind.Annual, 100m, null,
            new DateOnly(2026, 6, 1), new DateOnly(2026, 1, 1),
            AccrualMethod.StraightLine, false, 0m, null, null)).IsValid.Should().BeFalse();
    }
}
