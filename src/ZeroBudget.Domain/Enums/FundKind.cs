namespace ZeroBudget.Domain.Enums;

/// <summary>
/// The flavour of a <see cref="Entities.SinkingFund"/>, mirroring the three
/// sinking-fund systems in the household spreadsheet.
/// </summary>
public enum FundKind
{
    /// <summary>Irregular / annual discretionary cost (maintenance, gifts, holiday).</summary>
    Annual = 0,

    /// <summary>Contractual recurring commitment with a cover period (insurance, loan, car).</summary>
    Commitment = 1,

    /// <summary>A long-horizon savings goal (kitchen, sofa, wedding).</summary>
    Goal = 2
}
