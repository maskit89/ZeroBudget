using MediatR;

namespace ZeroBudget.Application.Rules.Commands.DeleteCategorizationRule;

/// <summary>Forgets a learned categorization rule.</summary>
public record DeleteCategorizationRuleCommand(Guid Id) : IRequest;
