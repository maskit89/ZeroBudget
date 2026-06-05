using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;
using ZeroBudget.Domain.ValueObjects;

namespace ZeroBudget.Application.Imports.Commands.ImportStatement;

public class ImportStatementCommandHandler : IRequestHandler<ImportStatementCommand, ImportStatementResult>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly IStatementParser _parser;

    public ImportStatementCommandHandler(
        IApplicationDbContext db,
        ICurrentUser currentUser,
        IStatementParser parser)
    {
        _db = db;
        _currentUser = currentUser;
        _parser = parser;
    }

    public async Task<ImportStatementResult> Handle(ImportStatementCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        var statement = _parser.Parse(request.Content);

        // Pre-load this user's existing references so re-importing the same
        // statement is idempotent (we never create a duplicate Transaction).
        var existingReferences = await _db.Transactions
            .Where(t => t.OwnerId == userId && t.BankReference != null)
            .Select(t => t.BankReference!)
            .ToListAsync(cancellationToken);

        var seen = new HashSet<string>(existingReferences, StringComparer.Ordinal);

        int imported = 0, skipped = 0, credits = 0, debits = 0;

        foreach (var entry in statement.Entries)
        {
            // Skip an entry we have already imported (by bank reference).
            if (entry.Reference is not null && !seen.Add(entry.Reference))
            {
                skipped++;
                continue;
            }

            _db.Transactions.Add(new Transaction
            {
                OwnerId = userId,
                Amount = entry.Amount,
                Currency = CurrencyCode.From(entry.Currency),
                ExchangeRate = 1m, // FX-rate resolution to the budget base is a follow-up
                Type = entry.IsCredit ? TransactionType.Income : TransactionType.Expense,
                Date = entry.BookingDate,
                Payee = Truncate(entry.Payee, 200),
                BankReference = entry.Reference,
            });

            imported++;
            if (entry.IsCredit) credits++; else debits++;
        }

        if (imported > 0)
        {
            await _db.SaveChangesAsync(cancellationToken);
        }

        return new ImportStatementResult(
            TotalEntries: statement.Entries.Count,
            Imported: imported,
            SkippedDuplicates: skipped,
            Credits: credits,
            Debits: debits,
            Iban: statement.Iban);
    }

    private static string Truncate(string value, int max) =>
        value.Length <= max ? value : value[..max];
}
