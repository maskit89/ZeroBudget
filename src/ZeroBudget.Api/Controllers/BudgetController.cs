using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZeroBudget.Application.Budgets.Commands.AddBudgetCategory;
using ZeroBudget.Application.Budgets.Commands.AddBudgetItem;
using ZeroBudget.Application.Budgets.Commands.DeleteBudgetCategory;
using ZeroBudget.Application.Budgets.Commands.DeleteBudgetItem;
using ZeroBudget.Application.Budgets.Commands.RenameBudgetCategory;
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

    /// <summary>Creates a new expense category group and returns the recomputed month.</summary>
    [HttpPost("categories")]
    [ProducesResponseType(typeof(BudgetMonthDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BudgetMonthDto>> AddCategory(
        AddBudgetCategoryRequest request,
        CancellationToken ct)
    {
        var result = await _mediator.Send(
            new AddBudgetCategoryCommand(request.BudgetMonthId, request.Name), ct);
        return Ok(result);
    }

    /// <summary>Renames a category group and returns the recomputed month.</summary>
    [HttpPut("categories/{id:guid}")]
    [ProducesResponseType(typeof(BudgetMonthDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BudgetMonthDto>> RenameCategory(
        Guid id,
        RenameBudgetCategoryRequest request,
        CancellationToken ct)
    {
        var result = await _mediator.Send(new RenameBudgetCategoryCommand(id, request.Name), ct);
        return Ok(result);
    }

    /// <summary>Deletes a category group (and its lines) and returns the recomputed month.</summary>
    [HttpDelete("categories/{id:guid}")]
    [ProducesResponseType(typeof(BudgetMonthDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BudgetMonthDto>> DeleteCategory(Guid id, CancellationToken ct)
    {
        var result = await _mediator.Send(new DeleteBudgetCategoryCommand(id), ct);
        return Ok(result);
    }

    /// <summary>
    /// Adds a new line to a category (an income source, or a spending line) and
    /// returns the recomputed month. The category id comes from the route.
    /// </summary>
    [HttpPost("categories/{categoryId:guid}/items")]
    [ProducesResponseType(typeof(BudgetMonthDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BudgetMonthDto>> AddItem(
        Guid categoryId,
        AddBudgetItemRequest request,
        CancellationToken ct)
    {
        var result = await _mediator.Send(
            new AddBudgetItemCommand(categoryId, request.Name, request.PlannedAmount), ct);
        return Ok(result);
    }

    /// <summary>Deletes a single budget line and returns the recomputed month.</summary>
    [HttpDelete("items/{id:guid}")]
    [ProducesResponseType(typeof(BudgetMonthDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BudgetMonthDto>> DeleteItem(Guid id, CancellationToken ct)
    {
        var result = await _mediator.Send(new DeleteBudgetItemCommand(id), ct);
        return Ok(result);
    }
}

/// <summary>Request body for updating a budget line (the id comes from the route).</summary>
public record UpdateBudgetItemRequest(decimal PlannedAmount, string? Name = null);

/// <summary>Request body for adding a budget line (the category id comes from the route).</summary>
public record AddBudgetItemRequest(string Name, decimal PlannedAmount = 0m);

/// <summary>Request body for creating a category group.</summary>
public record AddBudgetCategoryRequest(Guid BudgetMonthId, string Name);

/// <summary>Request body for renaming a category group (the id comes from the route).</summary>
public record RenameBudgetCategoryRequest(string Name);
