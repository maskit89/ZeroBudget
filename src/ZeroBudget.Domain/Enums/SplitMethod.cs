namespace ZeroBudget.Domain.Enums;

/// <summary>How a shared cost is divided across household members.</summary>
public enum SplitMethod
{
    /// <summary>Divided equally (the spreadsheet's 50/50).</summary>
    Equal = 0,

    /// <summary>Divided in proportion to each member's net income.</summary>
    ByIncomeRatio = 1
}
