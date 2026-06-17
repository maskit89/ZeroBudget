using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZeroBudget.Api.Features;
using ZeroBudget.Application.SinkingFunds.Commands.ArchiveSinkingFund;
using ZeroBudget.Application.SinkingFunds.Commands.CreateSinkingFund;
using ZeroBudget.Application.SinkingFunds.Commands.UpdateSinkingFund;
using ZeroBudget.Application.SinkingFunds.Dtos;
using ZeroBudget.Application.SinkingFunds.Queries.GetSinkingFunds;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Api.Controllers;

/// <summary>
/// The user's sinking funds and their derived figures (balance, required monthly
/// contribution, projection, status). Every handler is owner-scoped; the running
/// balance is computed from the budget lines, never stored.
/// </summary>
[ApiController]
[Authorize]
[FeatureGate(nameof(FeatureFlags.SinkingFunds))]
[Route("api/[controller]")]
public class SinkingFundsController : ControllerBase
{
    private readonly ISender _mediator;

    public SinkingFundsController(ISender mediator)
    {
        _mediator = mediator;
    }

    /// <summary>Lists the user's sinking funds with their derived figures.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<SinkingFundDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<SinkingFundDto>>> List(
        [FromQuery] bool includeArchived, CancellationToken ct)
    {
        var result = await _mediator.Send(new GetSinkingFundsQuery(includeArchived), ct);
        return Ok(result);
    }

    /// <summary>Defines a new sinking fund and returns it.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(SinkingFundDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<SinkingFundDto>> Create(CreateSinkingFundRequest request, CancellationToken ct)
    {
        var result = await _mediator.Send(new CreateSinkingFundCommand(
            request.Name, request.Kind, request.TargetAmount, request.TargetDate,
            request.CoverStart, request.CoverEnd, request.Accrual, request.RecurAnnually,
            request.OpeningBalance, request.OpeningAsOf, request.FundingAccountId), ct);
        return CreatedAtAction(nameof(List), new { }, result);
    }

    /// <summary>Edits a sinking fund's definition. Returns it.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(SinkingFundDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SinkingFundDto>> Update(Guid id, UpdateSinkingFundRequest request, CancellationToken ct)
    {
        var result = await _mediator.Send(new UpdateSinkingFundCommand(
            id, request.Name, request.Kind, request.TargetAmount, request.TargetDate,
            request.CoverStart, request.CoverEnd, request.Accrual, request.RecurAnnually,
            request.OpeningBalance, request.OpeningAsOf, request.FundingAccountId), ct);
        return Ok(result);
    }

    /// <summary>Archives or restores a sinking fund (soft). Returns it.</summary>
    [HttpPut("{id:guid}/archive")]
    [ProducesResponseType(typeof(SinkingFundDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SinkingFundDto>> Archive(Guid id, ArchiveSinkingFundRequest request, CancellationToken ct)
    {
        var result = await _mediator.Send(new ArchiveSinkingFundCommand(id, request.Archived), ct);
        return Ok(result);
    }
}

/// <summary>Request body for creating a sinking fund.</summary>
public record CreateSinkingFundRequest(
    string Name,
    FundKind Kind,
    decimal TargetAmount,
    DateOnly? TargetDate,
    DateOnly? CoverStart,
    DateOnly? CoverEnd,
    AccrualMethod Accrual,
    bool RecurAnnually,
    decimal OpeningBalance,
    DateOnly? OpeningAsOf,
    Guid? FundingAccountId);

/// <summary>Request body for editing a sinking fund (the id comes from the route).</summary>
public record UpdateSinkingFundRequest(
    string Name,
    FundKind Kind,
    decimal TargetAmount,
    DateOnly? TargetDate,
    DateOnly? CoverStart,
    DateOnly? CoverEnd,
    AccrualMethod Accrual,
    bool RecurAnnually,
    decimal OpeningBalance,
    DateOnly? OpeningAsOf,
    Guid? FundingAccountId);

/// <summary>Request body for archiving/restoring a sinking fund.</summary>
public record ArchiveSinkingFundRequest(bool Archived = true);
