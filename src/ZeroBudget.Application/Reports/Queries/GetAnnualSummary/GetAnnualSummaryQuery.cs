using MediatR;
using ZeroBudget.Application.Reports.Dtos;

namespace ZeroBudget.Application.Reports.Queries.GetAnnualSummary;

/// <summary>Rolls a single calendar year's budgets up into a 12-month overview.</summary>
public record GetAnnualSummaryQuery(int Year) : IRequest<AnnualSummaryDto>;
