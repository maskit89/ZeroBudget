using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.Transactions.Dtos;

namespace ZeroBudget.Application.Transactions.Commands.UpdateTransaction;

public class UpdateTransactionCommandHandler : IRequestHandler<UpdateTransactionCommand, TransactionDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public UpdateTransactionCommandHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<TransactionDto> Handle(UpdateTransactionCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        var transaction = await _db.Transactions
            .Include(t => t.BudgetItem)
            .FirstOrDefaultAsync(t => t.Id == request.TransactionId, cancellationToken);

        if (transaction is null)
        {
            throw new NotFoundException($"Transaction {request.TransactionId} was not found.");
        }
        if (transaction.OwnerId != userId)
        {
            throw new ForbiddenAccessException();
        }

        transaction.Date = request.Date;
        transaction.Payee = request.Payee.Trim();
        transaction.Amount = request.Amount;
        transaction.Type = request.Type;

        await _db.SaveChangesAsync(cancellationToken);

        return transaction.ToDto();
    }
}
