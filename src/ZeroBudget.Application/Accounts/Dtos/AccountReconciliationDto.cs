namespace ZeroBudget.Application.Accounts.Dtos;

/// <summary>
/// Reconciles a physical account against the sinking funds it backs: the account's
/// derived balance vs the total balance of the funds whose money should sit in it. The
/// <see cref="Float"/> is the difference — unallocated cash when positive, a shortfall
/// when negative. (Promotes the spreadsheet's manual "check" rows.)
/// </summary>
public class AccountReconciliationDto
{
    public Guid AccountId { get; set; }
    public string AccountName { get; set; } = string.Empty;

    /// <summary>The account's derived balance (opening + its transactions).</summary>
    public decimal CurrentBalance { get; set; }

    /// <summary>Total balance of the sinking funds that name this account as their funding account.</summary>
    public decimal BackedFundsTotal { get; set; }

    /// <summary>How many sinking funds this account backs.</summary>
    public int BackedFundCount { get; set; }

    /// <summary>CurrentBalance − BackedFundsTotal: unallocated float (or a shortfall when negative).</summary>
    public decimal Float { get; set; }
}
