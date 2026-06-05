using Microsoft.EntityFrameworkCore;
using Xunit;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.Imports.Commands.ImportStatement;
using ZeroBudget.Domain.Enums;
using ZeroBudget.Infrastructure.Persistence;
using ZeroBudget.Infrastructure.Statements;

namespace ZeroBudget.Application.Tests.Imports;

public class ImportStatementHandlerTests
{
    private sealed class CurrentUserStub : ICurrentUser
    {
        public CurrentUserStub(string? userId) => UserId = userId;
        public string? UserId { get; }
    }

    private static ApplicationDbContext NewContext() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"zbb-import-{Guid.NewGuid()}")
            .Options);

    private static ImportStatementCommandHandler NewHandler(ApplicationDbContext db, string userId) =>
        new(db, new CurrentUserStub(userId), new Camt053StatementParser());

    [Fact]
    public async Task Handle_ImportsAllEntries_WithCorrectSummary()
    {
        await using var db = NewContext();
        var handler = NewHandler(db, "user-1");

        var result = await handler.Handle(
            new ImportStatementCommand(Camt053Samples.ThreeEntries), CancellationToken.None);

        Assert.Equal(3, result.TotalEntries);
        Assert.Equal(3, result.Imported);
        Assert.Equal(0, result.SkippedDuplicates);
        Assert.Equal(1, result.Credits);
        Assert.Equal(2, result.Debits);
        Assert.Equal("DE89370400440532013000", result.Iban);
        Assert.Equal(3, await db.Transactions.CountAsync());
    }

    [Fact]
    public async Task Handle_PersistsCurrencyAndDirection()
    {
        await using var db = NewContext();
        await NewHandler(db, "user-1").Handle(
            new ImportStatementCommand(Camt053Samples.ThreeEntries), CancellationToken.None);

        var taxi = await db.Transactions.FirstAsync(t => t.BankReference == "E2E-TAXI-9");
        Assert.Equal("GBP", taxi.Currency.Value);
        Assert.Equal(TransactionType.Expense, taxi.Type);

        var salary = await db.Transactions.FirstAsync(t => t.BankReference == "REF-SALARY-001");
        Assert.Equal(TransactionType.Income, salary.Type);
        Assert.Equal("user-1", salary.OwnerId);
    }

    [Fact]
    public async Task Handle_ReImportingSameStatement_IsIdempotent()
    {
        await using var db = NewContext();
        var handler = NewHandler(db, "user-1");
        var cmd = new ImportStatementCommand(Camt053Samples.ThreeEntries);

        await handler.Handle(cmd, CancellationToken.None);
        var second = await handler.Handle(cmd, CancellationToken.None);

        Assert.Equal(0, second.Imported);
        Assert.Equal(3, second.SkippedDuplicates);
        Assert.Equal(3, await db.Transactions.CountAsync()); // still only 3 — no duplicates
    }

    [Fact]
    public async Task Handle_ScopesImportToTheCurrentUser()
    {
        await using var db = NewContext();
        await NewHandler(db, "user-1").Handle(
            new ImportStatementCommand(Camt053Samples.ThreeEntries), CancellationToken.None);

        // A different user importing the same statement gets their own copies
        // (dedup is per-user) and never sees user-1's rows.
        var other = await NewHandler(db, "user-2").Handle(
            new ImportStatementCommand(Camt053Samples.ThreeEntries), CancellationToken.None);

        Assert.Equal(3, other.Imported);
        Assert.Equal(3, await db.Transactions.CountAsync(t => t.OwnerId == "user-1"));
        Assert.Equal(3, await db.Transactions.CountAsync(t => t.OwnerId == "user-2"));
    }
}
