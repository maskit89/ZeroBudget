using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZeroBudget.Application.Paychecks.Commands.CreatePaycheck;
using ZeroBudget.Application.Paychecks.Commands.DeletePaycheck;
using ZeroBudget.Application.Paychecks.Commands.SetPaycheckAllocations;
using ZeroBudget.Application.Paychecks.Commands.UpdatePaycheck;
using ZeroBudget.Application.Paychecks.Dtos;
using ZeroBudget.Application.Paychecks.Queries.GetPaychecks;

namespace ZeroBudget.Api.Controllers;

/// <summary>
/// Paycheck planning: the expected pay deposits in a month and how each is spread
/// across budget lines. Every handler is owner-scoped.
/// </summary>
[ApiController]
[Authorize]
[Route("api/[controller]")]
public class PaychecksController : ControllerBase
{
    private readonly ISender _mediator;

    public PaychecksController(ISender mediator)
    {
        _mediator = mediator;
    }

    /// <summary>Lists the user's paychecks (with allocations) for a month.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<PaycheckDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<PaycheckDto>>> List(
        [FromQuery] int year, [FromQuery] int month, CancellationToken ct)
    {
        var result = await _mediator.Send(new GetPaychecksQuery(year, month), ct);
        return Ok(result);
    }

    /// <summary>Adds a paycheck to a month and returns it.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(PaycheckDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PaycheckDto>> Create(CreatePaycheckRequest request, CancellationToken ct)
    {
        var result = await _mediator.Send(
            new CreatePaycheckCommand(request.BudgetMonthId, request.Name, request.Date, request.PlannedAmount), ct);
        return CreatedAtAction(nameof(List), new { }, result);
    }

    /// <summary>Edits a paycheck's name, date and amount. Returns it.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(PaycheckDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PaycheckDto>> Update(Guid id, UpdatePaycheckRequest request, CancellationToken ct)
    {
        var result = await _mediator.Send(
            new UpdatePaycheckCommand(id, request.Name, request.Date, request.PlannedAmount), ct);
        return Ok(result);
    }

    /// <summary>Deletes a paycheck and its allocations.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeletePaycheckCommand(id), ct);
        return NoContent();
    }

    /// <summary>Replaces a paycheck's allocations across budget lines and returns it.</summary>
    [HttpPut("{id:guid}/allocations")]
    [ProducesResponseType(typeof(PaycheckDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PaycheckDto>> SetAllocations(
        Guid id, SetPaycheckAllocationsRequest request, CancellationToken ct)
    {
        var allocations = (request.Allocations ?? new List<PaycheckAllocationRequest>())
            .Select(a => new PaycheckAllocationInput(a.BudgetItemId, a.Amount))
            .ToList();
        var result = await _mediator.Send(new SetPaycheckAllocationsCommand(id, allocations), ct);
        return Ok(result);
    }
}

/// <summary>Request body for creating a paycheck.</summary>
public record CreatePaycheckRequest(Guid BudgetMonthId, string Name, DateOnly Date, decimal PlannedAmount);

/// <summary>Request body for editing a paycheck (the id comes from the route).</summary>
public record UpdatePaycheckRequest(string Name, DateOnly Date, decimal PlannedAmount);

/// <summary>Request body for replacing a paycheck's allocations.</summary>
public record SetPaycheckAllocationsRequest(IReadOnlyList<PaycheckAllocationRequest> Allocations);

/// <summary>One earmark: an amount assigned to a budget line.</summary>
public record PaycheckAllocationRequest(Guid BudgetItemId, decimal Amount);
