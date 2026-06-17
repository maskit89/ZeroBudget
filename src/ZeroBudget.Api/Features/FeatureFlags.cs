namespace ZeroBudget.Api.Features;

/// <summary>
/// Toggles for the features that go beyond the EveryDollar core. All default ON, so
/// the app ships with everything; turning one OFF (via the "Features" config section)
/// hides it and 404s its endpoints — a "pure EveryDollar" mode.
/// </summary>
public class FeatureFlags
{
    public const string SectionName = "Features";

    /// <summary>Accounts &amp; derived balances (YNAB-style register).</summary>
    public bool Accounts { get; set; } = true;

    /// <summary>Foreign-currency transactions and FX (EveryDollar is USD-only).</summary>
    public bool MultiCurrency { get; set; } = true;

    /// <summary>CAMT.053 SEPA statement import.</summary>
    public bool CamtImport { get; set; } = true;

    /// <summary>Reports, trends and the annual overview.</summary>
    public bool Reports { get; set; } = true;

    /// <summary>Sinking-fund management: targets, due dates, accrual methods and projections.</summary>
    public bool SinkingFunds { get; set; } = true;

    public bool IsEnabled(string feature) => feature switch
    {
        nameof(Accounts) => Accounts,
        nameof(MultiCurrency) => MultiCurrency,
        nameof(CamtImport) => CamtImport,
        nameof(Reports) => Reports,
        nameof(SinkingFunds) => SinkingFunds,
        _ => true,
    };
}
