using MediatR;
using ZeroBudget.Application.Common.Security;
using ZeroBudget.Application.Transactions.Dtos;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Application.Transactions.Commands.CreateTransaction;

/// <summary>
/// Creates a transaction the user entered by hand in the sheet (in the budget's
/// base currency). Optionally assigns it to a budget line — whose Spent then
/// includes it — and/or to an account. Returns the created transaction.
/// </summary>
[AllowLimited]
public record CreateTransactionCommand(
    DateOnly Date,
    string Payee,
    decimal Amount,
    TransactionType Type,
    Guid? BudgetItemId,
    Guid? AccountId = null,
    Guid? MemberId = null) : IRequest<TransactionDto>;
