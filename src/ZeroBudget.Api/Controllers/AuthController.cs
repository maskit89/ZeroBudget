using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using ZeroBudget.Api.Contracts.Auth;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Infrastructure.Identity;
using ZeroBudget.Infrastructure.Persistence;

namespace ZeroBudget.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IJwtTokenGenerator _tokenGenerator;
    private readonly ApplicationDbContext _db;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        IJwtTokenGenerator tokenGenerator,
        ApplicationDbContext db)
    {
        _userManager = userManager;
        _tokenGenerator = tokenGenerator;
        _db = db;
    }

    /// <summary>Creates an account, seeds a starter budget and returns a JWT.</summary>
    [HttpPost("register")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Register(RegisterRequest request, CancellationToken ct)
    {
        var existing = await _userManager.FindByEmailAsync(request.Email);
        if (existing is not null)
        {
            return BadRequest(new { error = "An account with that email already exists." });
        }

        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            DisplayName = request.DisplayName
        };

        var result = await _userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return BadRequest(new { errors = result.Errors.Select(e => e.Description) });
        }

        // Give the new user something to look at on first login.
        var now = DateTime.UtcNow;
        await BudgetSeeder.SeedDefaultMonthAsync(_db, user.Id, now.Year, now.Month, ct);

        return Ok(BuildResponse(user));
    }

    /// <summary>Validates credentials and returns a JWT.</summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user is null || !await _userManager.CheckPasswordAsync(user, request.Password))
        {
            // Same response for unknown user and bad password — no account enumeration.
            return Unauthorized(new { error = "Invalid email or password." });
        }

        return Ok(BuildResponse(user));
    }

    private AuthResponse BuildResponse(ApplicationUser user)
    {
        var (token, expiresAt) = _tokenGenerator.Generate(user.Id, user.Email!);
        return new AuthResponse(token, expiresAt, user.Id, user.Email!);
    }
}
