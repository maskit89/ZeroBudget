using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZeroBudget.Application.Transactions.Commands.AssignTransaction;
using ZeroBudget.Application.Transactions.Commands.CreateTransaction;
using ZeroBudget.Application.Transactions.Commands.DeleteTransaction;
using ZeroBudget.Application.Transactions.Commands.UpdateTransaction;
using ZeroBudget.Application.Transactions.Dtos;
using ZeroBudget.Application.Transactions.Queries.GetTransactions;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class TransactionsController : ControllerBase
{
    private readonly ISender _mediator;

    public TransactionsController(ISender mediator)
    {
        _mediator = mediator;
    }

    /// <summary>Lists the user's transactions, optionally filtered by month / unassigned.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<TransactionDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<TransactionDto>>> List(
        [FromQuery] int? year,
        [FromQuery] int? month,
        [FromQuery] bool unassignedOnly = false,
        CancellationToken ct = default)
    {
        var result = await _mediator.Send(new GetTransactionsQuery(year, month, unassignedOnly), ct);
        return Ok(result);
    }

    /// <summary>Creates a manually-entered transaction and returns it.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(TransactionDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TransactionDto>> Create(
        CreateTransactionRequest request,
        CancellationToken ct)
    {
        var result = await _mediator.Send(
            new CreateTransactionCommand(
                request.Date, request.Payee, request.Amount, request.Type, request.BudgetItemId),
            ct);
        return CreatedAtAction(nameof(List), new { }, result);
    }

    /// <summary>Edits a transaction's date, payee, amount and direction. Returns it.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(TransactionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TransactionDto>> Update(
        Guid id,
        UpdateTransactionRequest request,
        CancellationToken ct)
    {
        var result = await _mediator.Send(
            new UpdateTransactionCommand(id, request.Date, request.Payee, request.Amount, request.Type), ct);
        return Ok(result);
    }

    /// <summary>Deletes one of the user's transactions.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteTransactionCommand(id), ct);
        return NoContent();
    }

    /// <summary>Assigns a transaction to a budget line, or clears it when budgetItemId is null.</summary>
    [HttpPut("{id:guid}/assignment")]
    [ProducesResponseType(typeof(TransactionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TransactionDto>> Assign(
        Guid id,
        AssignTransactionRequest request,
        CancellationToken ct)
    {
        var result = await _mediator.Send(new AssignTransactionCommand(id, request.BudgetItemId), ct);
        return Ok(result);
    }
}

/// <summary>Request body for assigning a transaction (null clears the assignment).</summary>
public record AssignTransactionRequest(Guid? BudgetItemId);

/// <summary>Request body for creating a manual transaction.</summary>
public record CreateTransactionRequest(
    DateOnly Date,
    string Payee,
    decimal Amount,
    TransactionType Type,
    Guid? BudgetItemId);

/// <summary>Request body for editing a transaction (the id comes from the route).</summary>
public record UpdateTransactionRequest(
    DateOnly Date,
    string Payee,
    decimal Amount,
    TransactionType Type);
