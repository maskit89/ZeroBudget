using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Application.Transactions.Dtos;

public class TransactionDto
{
    public Guid Id { get; set; }
    public DateOnly Date { get; set; }
    public string Payee { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "EUR";
    public decimal ExchangeRate { get; set; }

    /// <summary>Amount in the budget base currency (Amount × ExchangeRate).</summary>
    public decimal BaseAmount { get; set; }

    public TransactionType Type { get; set; }
    public string? BankReference { get; set; }

    public Guid? BudgetItemId { get; set; }
    public string? BudgetItemName { get; set; }

    /// <summary>True when the transaction is split across budget lines.</summary>
    public bool IsSplit { get; set; }

    /// <summary>The per-line slices when <see cref="IsSplit"/>; empty otherwise.</summary>
    public IReadOnlyList<TransactionSplitDto> Splits { get; set; } = Array.Empty<TransactionSplitDto>();
}

public class TransactionSplitDto
{
    public Guid Id { get; set; }
    public Guid? BudgetItemId { get; set; }
    public string? BudgetItemName { get; set; }
    public decimal Amount { get; set; }
}

public static class TransactionMapping
{
    public static TransactionDto ToDto(this Transaction t) => new()
    {
        Id = t.Id,
        Date = t.Date,
        Payee = t.Payee,
        Amount = t.Amount,
        Currency = t.Currency.Value,
        ExchangeRate = t.ExchangeRate,
        BaseAmount = t.BaseAmount,
        Type = t.Type,
        BankReference = t.BankReference,
        BudgetItemId = t.BudgetItemId,
        BudgetItemName = t.BudgetItem?.Name,
        IsSplit = t.Splits.Count > 0,
        Splits = t.Splits
            .Select(s => new TransactionSplitDto
            {
                Id = s.Id,
                BudgetItemId = s.BudgetItemId,
                BudgetItemName = s.BudgetItem?.Name,
                Amount = s.Amount,
            })
            .ToList(),
    };
}
