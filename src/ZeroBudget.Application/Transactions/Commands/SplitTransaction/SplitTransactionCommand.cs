using MediatR;
using ZeroBudget.Application.Transactions.Dtos;

namespace ZeroBudget.Application.Transactions.Commands.SplitTransaction;

/// <summary>
/// Splits one transaction across two or more budget lines. The slice amounts
/// must sum to the transaction's total, and each target line must match the
/// transaction's direction (an expense splits across expense lines, income
/// across income lines). The whole-transaction assignment is replaced by the
/// slices, and each target line switches to transaction tracking.
/// </summary>
public record SplitTransactionCommand(
    Guid TransactionId,
    IReadOnlyList<SplitAllocationInput> Allocations) : IRequest<TransactionDto>;

/// <summary>One requested slice: an amount attributed to a budget line.</summary>
public record SplitAllocationInput(Guid BudgetItemId, decimal Amount);
