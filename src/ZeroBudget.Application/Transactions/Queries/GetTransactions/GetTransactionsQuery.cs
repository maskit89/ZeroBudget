using MediatR;
using ZeroBudget.Application.Transactions.Dtos;

namespace ZeroBudget.Application.Transactions.Queries.GetTransactions;

/// <summary>
/// Lists the current user's transactions, most recent first. Optionally filtered
/// to a month (by booking date) and/or to unassigned entries only.
/// </summary>
public record GetTransactionsQuery(
    int? Year = null,
    int? Month = null,
    bool UnassignedOnly = false) : IRequest<IReadOnlyList<TransactionDto>>;
