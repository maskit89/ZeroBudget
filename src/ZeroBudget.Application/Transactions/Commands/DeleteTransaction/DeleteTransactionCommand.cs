using MediatR;
using ZeroBudget.Application.Common.Security;

namespace ZeroBudget.Application.Transactions.Commands.DeleteTransaction;

/// <summary>Deletes one of the user's transactions.</summary>
[AllowLimited]
public record DeleteTransactionCommand(Guid TransactionId) : IRequest;
