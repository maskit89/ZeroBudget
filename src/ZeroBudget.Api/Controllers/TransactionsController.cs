using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZeroBudget.Application.Transactions.Commands.AssignTransaction;
using ZeroBudget.Application.Transactions.Dtos;
using ZeroBudget.Application.Transactions.Queries.GetTransactions;

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
