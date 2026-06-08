using ZeroBudget.Domain.Entities;

namespace ZeroBudget.Application.Rules.Dtos;

/// <summary>
/// A learned "payee → budget line" rule, surfaced for the management screen.
/// <see cref="Payee"/> is the normalized match key that was learned.
/// </summary>
public class CategorizationRuleDto
{
    public Guid Id { get; set; }
    public string Payee { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    public string ItemName { get; set; } = string.Empty;
}

public static class CategorizationRuleMapping
{
    public static CategorizationRuleDto ToDto(this CategorizationRule r) => new()
    {
        Id = r.Id,
        Payee = r.PayeeKey,
        CategoryName = r.CategoryName,
        ItemName = r.ItemName,
    };
}
