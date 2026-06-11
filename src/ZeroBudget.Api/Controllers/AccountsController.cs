using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZeroBudget.Application.Accounts.Commands.CreateAccount;
using ZeroBudget.Application.Accounts.Commands.DeleteAccount;
using ZeroBudget.Application.Accounts.Commands.UpdateAccount;
using ZeroBudget.Application.Accounts.Dtos;
using ZeroBudget.Application.Accounts.Queries.GetAccounts;
using ZeroBudget.Api.Features;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Api.Controllers;

/// <summary>
/// The user's accounts and their derived balances. Every handler is owner-scoped.
/// An account's balance is computed from its transactions, never stored.
/// </summary>
[ApiController]
[Authorize]
[FeatureGate(nameof(FeatureFlags.Accounts))]
[Route("api/[controller]")]
public class AccountsController : ControllerBase
{
    private readonly ISender _mediator;

    public AccountsController(ISender mediator)
    {
        _mediator = mediator;
    }

    /// <summary>Lists the user's accounts with their current (derived) balances.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<AccountDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AccountDto>>> List(CancellationToken ct)
    {
        var result = await _mediator.Send(new GetAccountsQuery(), ct);
        return Ok(result);
    }

    /// <summary>Creates a new account and returns it.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(AccountDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AccountDto>> Create(CreateAccountRequest request, CancellationToken ct)
    {
        var result = await _mediator.Send(
            new CreateAccountCommand(request.Name, request.Type, request.Currency, request.OpeningBalance), ct);
        return CreatedAtAction(nameof(List), new { }, result);
    }

    /// <summary>Edits an account's name, type and opening balance. Returns it.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(AccountDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AccountDto>> Update(Guid id, UpdateAccountRequest request, CancellationToken ct)
    {
        var result = await _mediator.Send(
            new UpdateAccountCommand(id, request.Name, request.Type, request.OpeningBalance), ct);
        return Ok(result);
    }

    /// <summary>Deletes an account; its transactions survive but become unlinked.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteAccountCommand(id), ct);
        return NoContent();
    }
}

/// <summary>Request body for creating an account.</summary>
public record CreateAccountRequest(string Name, AccountType Type, string Currency, decimal OpeningBalance);

/// <summary>Request body for editing an account (the id comes from the route; currency is immutable).</summary>
public record UpdateAccountRequest(string Name, AccountType Type, decimal OpeningBalance);
