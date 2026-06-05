using ZeroBudget.Application.Imports.Models;

namespace ZeroBudget.Application.Common.Interfaces;

/// <summary>
/// Parses a bank statement document into a normalized <see cref="ParsedStatement"/>.
/// Implemented in Infrastructure as a format adapter (CAMT.053 today, others later).
/// </summary>
public interface IStatementParser
{
    /// <summary>Parse statement content. Throws <see cref="Exceptions.StatementParseException"/> on malformed input.</summary>
    ParsedStatement Parse(string content);
}
