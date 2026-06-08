using MediatR;
using ZeroBudget.Application.Rules.Dtos;

namespace ZeroBudget.Application.Rules.Commands.UpdateCategorizationRule;

/// <summary>
/// Re-points a learned rule at a different budget line (by category/item name).
/// The matched payee key is immutable — delete the rule to forget a payee.
/// Returns the updated rule.
/// </summary>
public record UpdateCategorizationRuleCommand(
    Guid Id,
    string CategoryName,
    string ItemName) : IRequest<CategorizationRuleDto>;
