using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ZeroBudget.Application.Imports.Commands.ImportStatement;

namespace ZeroBudget.Api.Controllers;

/// <summary>
/// Bank statement import. Requires a valid JWT; the handler attributes every
/// imported transaction to the authenticated user.
/// </summary>
[ApiController]
[Authorize]
[Route("api/[controller]")]
public class ImportController : ControllerBase
{
    private readonly ISender _mediator;

    public ImportController(ISender mediator)
    {
        _mediator = mediator;
    }

    /// <summary>Upload a CAMT.053 XML statement; entries are de-duplicated on re-import.</summary>
    [HttpPost("camt053")]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10 MB cap
    [ProducesResponseType(typeof(ImportStatementResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<ImportStatementResult>> ImportCamt053(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { error = "No file was uploaded." });
        }

        using var reader = new StreamReader(file.OpenReadStream());
        var content = await reader.ReadToEndAsync(ct);

        var result = await _mediator.Send(new ImportStatementCommand(content), ct);
        return Ok(result);
    }
}
