using MediatR;

namespace ZeroBudget.Application.Imports.Commands.ImportStatement;

/// <summary>
/// Imports a CAMT.053 bank statement for the current user. When an
/// <paramref name="AccountId"/> is given, every imported transaction is stamped with
/// that account so its balance reflects the statement.
/// </summary>
public record ImportStatementCommand(string Content, Guid? AccountId = null) : IRequest<ImportStatementResult>;

/// <summary>Summary of what an import did.</summary>
public record ImportStatementResult(
    int TotalEntries,
    int Imported,
    int SkippedDuplicates,
    int Credits,
    int Debits,
    string? Iban,
    int AutoCategorized = 0);
