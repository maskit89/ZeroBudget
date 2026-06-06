using MediatR;
using ZeroBudget.Application.Transactions.Dtos;

namespace ZeroBudget.Application.Transactions.Commands.AssignTransaction;

/// <summary>
/// Assigns a transaction to a budget line (or clears the assignment when
/// <paramref name="BudgetItemId"/> is null). The line's actual spending then
/// reflects this transaction on the next budget read.
/// </summary>
public record AssignTransactionCommand(Guid TransactionId, Guid? BudgetItemId)
    : IRequest<TransactionDto>;
