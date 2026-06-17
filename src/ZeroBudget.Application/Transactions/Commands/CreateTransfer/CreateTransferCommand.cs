using MediatR;
using ZeroBudget.Application.Transactions.Dtos;

namespace ZeroBudget.Application.Transactions.Commands.CreateTransfer;

/// <summary>
/// Moves money between two of the user's own accounts. Recorded as a single
/// <see cref="Domain.Enums.TransactionType.Transfer"/> transaction (source =
/// <paramref name="FromAccountId"/>, destination = <paramref name="ToAccountId"/>) that
/// is excluded from budget actuals. Returns the created transaction.
/// </summary>
public record CreateTransferCommand(
    DateOnly Date,
    decimal Amount,
    Guid FromAccountId,
    Guid ToAccountId,
    string? Payee = null) : IRequest<TransactionDto>;
