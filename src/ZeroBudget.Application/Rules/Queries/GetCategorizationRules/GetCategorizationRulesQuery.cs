using MediatR;
using ZeroBudget.Application.Rules.Dtos;

namespace ZeroBudget.Application.Rules.Queries.GetCategorizationRules;

/// <summary>Lists the user's learned categorization rules for the management screen.</summary>
public record GetCategorizationRulesQuery : IRequest<IReadOnlyList<CategorizationRuleDto>>;
