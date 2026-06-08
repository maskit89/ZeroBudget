using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZeroBudget.Application.Rules.Commands.DeleteCategorizationRule;
using ZeroBudget.Application.Rules.Commands.UpdateCategorizationRule;
using ZeroBudget.Application.Rules.Dtos;
using ZeroBudget.Application.Rules.Queries.GetCategorizationRules;

namespace ZeroBudget.Api.Controllers;

/// <summary>
/// Manage the learned "payee → budget line" categorization rules. Every action
/// is owner-scoped in its MediatR handler.
/// </summary>
[ApiController]
[Authorize]
[Route("api/[controller]")]
public class RulesController : ControllerBase
{
    private readonly ISender _mediator;

    public RulesController(ISender mediator)
    {
        _mediator = mediator;
    }

    /// <summary>Lists the user's learned categorization rules.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<CategorizationRuleDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CategorizationRuleDto>>> List(CancellationToken ct)
    {
        var result = await _mediator.Send(new GetCategorizationRulesQuery(), ct);
        return Ok(result);
    }

    /// <summary>Re-points a rule at a different budget line (by category/item name).</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(CategorizationRuleDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CategorizationRuleDto>> Update(
        Guid id,
        UpdateCategorizationRuleRequest request,
        CancellationToken ct)
    {
        var result = await _mediator.Send(
            new UpdateCategorizationRuleCommand(id, request.CategoryName, request.ItemName), ct);
        return Ok(result);
    }

    /// <summary>Forgets a learned categorization rule.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteCategorizationRuleCommand(id), ct);
        return NoContent();
    }
}

/// <summary>Request body for re-pointing a rule (the id comes from the route).</summary>
public record UpdateCategorizationRuleRequest(string CategoryName, string ItemName);
