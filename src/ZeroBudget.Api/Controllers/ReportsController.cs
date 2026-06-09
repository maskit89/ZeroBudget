using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZeroBudget.Application.Reports.Dtos;
using ZeroBudget.Application.Reports.Queries.GetAnnualSummary;
using ZeroBudget.Application.Reports.Queries.GetBudgetTrends;

namespace ZeroBudget.Api.Controllers;

/// <summary>
/// Read-only analytics over the user's own budgets. Every query is owner-scoped
/// in its MediatR handler.
/// </summary>
[ApiController]
[Authorize]
[Route("api/[controller]")]
public class ReportsController : ControllerBase
{
    private readonly ISender _mediator;

    public ReportsController(ISender mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Income / planned / spent rolled up over the user's most recent
    /// <paramref name="months"/> budgets (chronological).
    /// </summary>
    [HttpGet("trends")]
    [ProducesResponseType(typeof(BudgetTrendsDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<BudgetTrendsDto>> Trends(
        [FromQuery] int months = 6,
        CancellationToken ct = default)
    {
        var result = await _mediator.Send(new GetBudgetTrendsQuery(months), ct);
        return Ok(result);
    }

    /// <summary>A 12-month overview (income / planned / spent + totals) for one calendar year.</summary>
    [HttpGet("annual/{year:int}")]
    [ProducesResponseType(typeof(AnnualSummaryDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<AnnualSummaryDto>> Annual(int year, CancellationToken ct)
    {
        var result = await _mediator.Send(new GetAnnualSummaryQuery(year), ct);
        return Ok(result);
    }
}
