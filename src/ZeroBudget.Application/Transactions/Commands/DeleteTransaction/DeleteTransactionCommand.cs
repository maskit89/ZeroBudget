using MediatR;

namespace ZeroBudget.Application.Transactions.Commands.DeleteTransaction;

/// <summary>Deletes one of the user's transactions.</summary>
public record DeleteTransactionCommand(Guid TransactionId) : IRequest;
