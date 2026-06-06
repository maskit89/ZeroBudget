using System.Text.RegularExpressions;
using ZeroBudget.Domain.Common;

namespace ZeroBudget.Domain.Entities;

/// <summary>
/// A learned mapping "payee → budget line", remembered when a user manually
/// assigns a transaction. On import, a matching payee is auto-assigned to the
/// line of the same name in that entry's month. The target is stored by
/// <see cref="CategoryName"/>/<see cref="ItemName"/> (not an item id) so a rule
/// applies across months — each month has its own item rows.
/// </summary>
public partial class CategorizationRule : BaseEntity
{
    public string OwnerId { get; set; } = string.Empty;

    /// <summary>Normalized payee (see <see cref="NormalizeKey"/>). Unique per owner.</summary>
    public string PayeeKey { get; set; } = string.Empty;

    public string CategoryName { get; set; } = string.Empty;
    public string ItemName { get; set; } = string.Empty;

    /// <summary>
    /// Normalize a payee into a stable match key: trimmed, lower-cased, with
    /// internal whitespace collapsed. Returns "" for blank input (no rule).
    /// </summary>
    public static string NormalizeKey(string? payee)
    {
        if (string.IsNullOrWhiteSpace(payee))
        {
            return string.Empty;
        }
        return WhitespacePattern().Replace(payee.Trim().ToLowerInvariant(), " ");
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespacePattern();
}
