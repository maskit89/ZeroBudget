using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.Transactions.Dtos;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;
using ZeroBudget.Domain.ValueObjects;

namespace ZeroBudget.Application.Transactions.Commands.CreateTransaction;

public class CreateTransactionCommandHandler : IRequestHandler<CreateTransactionCommand, TransactionDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public CreateTransactionCommandHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<TransactionDto> Handle(CreateTransactionCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        BudgetItem? item = null;
        if (request.BudgetItemId is Guid itemId)
        {
            item = await _db.BudgetItems
                .Include(i => i.BudgetCategory)
                    .ThenInclude(c => c.BudgetMonth)
                .FirstOrDefaultAsync(i => i.Id == itemId, cancellationToken);

            if (item is null)
            {
                throw new NotFoundException($"Budget item {itemId} was not found.");
            }
            if (item.BudgetCategory.BudgetMonth.OwnerId != userId)
            {
                throw new ForbiddenAccessException();
            }

            // A line with a transaction on it is tracked by transactions.
            item.ActualEntryMode = ActualEntryMode.Tracked;
        }

        Account? account = null;
        if (request.AccountId is Guid accountId)
        {
            account = await _db.Accounts
                .FirstOrDefaultAsync(a => a.Id == accountId, cancellationToken);

            if (account is null)
            {
                throw new NotFoundException($"Account {accountId} was not found.");
            }
            if (account.OwnerId != userId)
            {
                throw new ForbiddenAccessException();
            }
        }

        // Manual entries are in the budget's base currency for that month (no FX).
        var month = await _db.BudgetMonths
            .AsNoTracking()
            .FirstOrDefaultAsync(
                m => m.OwnerId == userId
                     && m.Year == request.Date.Year
                     && m.Month == request.Date.Month,
                cancellationToken);
        var currency = month?.BaseCurrency ?? CurrencyCode.Eur;

        var transaction = new Transaction
        {
            OwnerId = userId,
            Date = request.Date,
            Payee = request.Payee.Trim(),
            Amount = request.Amount,
            Currency = currency,
            ExchangeRate = 1m,
            Type = request.Type,
            BudgetItem = item,
            BudgetItemId = item?.Id,
            Account = account,
            AccountId = account?.Id,
        };

        _db.Transactions.Add(transaction);
        await _db.SaveChangesAsync(cancellationToken);

        return transaction.ToDto();
    }
}
