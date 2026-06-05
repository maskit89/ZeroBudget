using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZeroBudget.Application.Budgets.Commands.UpdateBudgetItem;
using ZeroBudget.Application.Budgets.Dtos;
using ZeroBudget.Application.Budgets.Queries.GetBudgetMonth;

namespace ZeroBudget.Api.Controllers;

/// <summary>
/// All budgeting endpoints require a valid JWT. The MediatR handlers behind
/// these actions additionally scope every read/write to the caller's own data.
/// </summary>
[ApiController]
[Authorize]
[Route("api/[controller]")]
public class BudgetController : ControllerBase
{
    private readonly ISender _mediator;

    public BudgetController(ISender mediator)
    {
        _mediator = mediator;
    }

    /// <summary>Gets the authenticated user's budget for a specific month.</summary>
    [HttpGet("{year:int}/{month:int}")]
    [ProducesResponseType(typeof(BudgetMonthDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BudgetMonthDto>> GetMonth(int year, int month, CancellationToken ct)
    {
        var result = await _mediator.Send(new GetBudgetMonthQuery(year, month), ct);
        return Ok(result);
    }

    /// <summary>Convenience endpoint for the current (server-side) month.</summary>
    [HttpGet("current")]
    [ProducesResponseType(typeof(BudgetMonthDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<BudgetMonthDto>> GetCurrentMonth(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var result = await _mediator.Send(new GetBudgetMonthQuery(now.Year, now.Month), ct);
        return Ok(result);
    }

    /// <summary>
    /// Updates a single line's planned amount (and optionally its name) and returns
    /// the recomputed month, including the new "Remaining to Budget" pool.
    /// </summary>
    [HttpPut("items/{id:guid}")]
    [ProducesResponseType(typeof(BudgetMonthDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BudgetMonthDto>> UpdateItem(
        Guid id,
        UpdateBudgetItemRequest request,
        CancellationToken ct)
    {
        var result = await _mediator.Send(
            new UpdateBudgetItemCommand(id, request.PlannedAmount, request.Name), ct);
        return Ok(result);
    }
}

/// <summary>Request body for updating a budget line (the id comes from the route).</summary>
public record UpdateBudgetItemRequest(decimal PlannedAmount, string? Name = null);
