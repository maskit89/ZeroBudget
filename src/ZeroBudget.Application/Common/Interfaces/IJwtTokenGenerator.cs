namespace ZeroBudget.Application.Common.Interfaces;

/// <summary>Issues signed JWTs for authenticated users. Implemented in Infrastructure.</summary>
public interface IJwtTokenGenerator
{
    /// <returns>The signed compact JWT and the UTC instant at which it expires.</returns>
    (string Token, DateTime ExpiresAtUtc) Generate(string userId, string email);
}
