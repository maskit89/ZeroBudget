using MediatR;
using ZeroBudget.Application.Household.Dtos;

namespace ZeroBudget.Application.Household.Queries.GetMemberSpending;

/// <summary>
/// Per-member attributed spending across all of the user's transactions — the
/// "who owes what" lens the workbook keeps by hand (the Visa Liz/Chris/Marisa
/// columns). Owner-scoped; active members only.
/// </summary>
public record GetMemberSpendingQuery : IRequest<IReadOnlyList<MemberSpendingDto>>;
