using MediatR;

namespace ZeroBudget.Application.Imports.Commands.ImportStatement;

/// <summary>Imports a CAMT.053 bank statement for the current user.</summary>
public record ImportStatementCommand(string Content) : IRequest<ImportStatementResult>;

/// <summary>Summary of what an import did.</summary>
public record ImportStatementResult(
    int TotalEntries,
    int Imported,
    int SkippedDuplicates,
    int Credits,
    int Debits,
    string? Iban,
    int AutoCategorized = 0);
