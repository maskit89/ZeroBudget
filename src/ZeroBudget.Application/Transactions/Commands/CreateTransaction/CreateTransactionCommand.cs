using MediatR;
using ZeroBudget.Application.Transactions.Dtos;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Application.Transactions.Commands.CreateTransaction;

/// <summary>
/// Creates a transaction the user entered by hand in the sheet (in the budget's
/// base currency). Optionally assigns it to a budget line — which switches that
/// line to transaction tracking. Returns the created transaction.
/// </summary>
public record CreateTransactionCommand(
    DateOnly Date,
    string Payee,
    decimal Amount,
    TransactionType Type,
    Guid? BudgetItemId) : IRequest<TransactionDto>;
