using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using ZeroBudget.Domain.ValueObjects;

namespace ZeroBudget.Infrastructure.Persistence.Converters;

/// <summary>
/// Persists a <see cref="CurrencyCode"/> value object as its three-letter string
/// and rebuilds (re-validating) it on the way back out.
/// </summary>
public class CurrencyCodeConverter : ValueConverter<CurrencyCode, string>
{
    public CurrencyCodeConverter()
        : base(code => code.Value, value => CurrencyCode.From(value))
    {
    }
}
