using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Api.Contracts.Auth;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.HouseholdAccess.Commands.AcceptInvite;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;
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
    private readonly ISender _mediator;
    private readonly ICurrentUser _currentUser;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        IJwtTokenGenerator tokenGenerator,
        ApplicationDbContext db,
        ISender mediator,
        ICurrentUser currentUser)
    {
        _userManager = userManager;
        _tokenGenerator = tokenGenerator;
        _db = db;
        _mediator = mediator;
        _currentUser = currentUser;
    }

    /// <summary>Creates an account, seeds a starter budget + owner membership, returns a JWT.</summary>
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

        // The new user owns their own household, and gets a starter budget to look at.
        var now = DateTime.UtcNow;
        _db.HouseholdMemberships.Add(new HouseholdMembership
        {
            OwnerId = user.Id,
            UserId = user.Id,
            Role = HouseholdRole.Owner,
            Status = MembershipStatus.Active,
            InvitedEmail = user.Email!,
            DisplayName = user.DisplayName,
            CreatedUtc = now,
        });
        await _db.SaveChangesAsync(ct);
        await BudgetSeeder.SeedDefaultMonthAsync(_db, user.Id, now.Year, now.Month, ct);

        return Ok(await BuildResponseAsync(user, ct));
    }

    /// <summary>Validates credentials and returns a JWT.</summary>
    [HttpPost("login")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login(LoginRequest request, CancellationToken ct)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user is null || !await _userManager.CheckPasswordAsync(user, request.Password))
        {
            // Same response for unknown user and bad password — no account enumeration.
            return Unauthorized(new { error = "Invalid email or password." });
        }

        return Ok(await BuildResponseAsync(user, ct));
    }

    /// <summary>Redeems a one-time invite link, creates the login and returns a JWT.</summary>
    [HttpPost("accept-invite")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AcceptInvite(AcceptInviteRequest request, CancellationToken ct)
    {
        var result = await _mediator.Send(
            new AcceptInviteCommand(request.Token, request.Password, request.DisplayName), ct);

        var (token, expiresAt) = _tokenGenerator.Generate(result.UserId, result.Email);
        return Ok(new AuthResponse(token, expiresAt, result.UserId, result.Email, result.Role, request.DisplayName));
    }

    /// <summary>Changes the authenticated login's own password.</summary>
    [HttpPost("change-password")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null)
        {
            return Unauthorized();
        }

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
        {
            return Unauthorized();
        }

        var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            return BadRequest(new { errors = result.Errors.Select(e => e.Description) });
        }

        return NoContent();
    }

    /// <summary>The authenticated login's identity, household and access level.</summary>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(MeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Me()
    {
        var userId = _currentUser.UserId;
        if (userId is null)
        {
            return Unauthorized();
        }

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
        {
            return Unauthorized();
        }

        return Ok(new MeResponse(
            userId,
            user.Email!,
            user.DisplayName,
            _currentUser.Role ?? HouseholdRole.Owner,
            _currentUser.OwnerId ?? userId,
            _currentUser.MemberId));
    }

    private async Task<AuthResponse> BuildResponseAsync(ApplicationUser user, CancellationToken ct)
    {
        var role = await _db.HouseholdMemberships
            .Where(m => m.UserId == user.Id && m.Status == MembershipStatus.Active)
            .Select(m => (HouseholdRole?)m.Role)
            .FirstOrDefaultAsync(ct) ?? HouseholdRole.Owner;

        var (token, expiresAt) = _tokenGenerator.Generate(user.Id, user.Email!);
        return new AuthResponse(token, expiresAt, user.Id, user.Email!, role, user.DisplayName);
    }
}
