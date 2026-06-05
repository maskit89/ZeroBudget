namespace ZeroBudget.Application.Common.Interfaces;

/// <summary>
/// Provides the id of the currently authenticated user. Implemented in the
/// API layer by reading the JWT claims off the HTTP context. Application
/// handlers use this to scope every query/command to the caller's own data.
/// </summary>
public interface ICurrentUser
{
    /// <summary>The authenticated user's id, or null if the request is anonymous.</summary>
    string? UserId { get; }
}
