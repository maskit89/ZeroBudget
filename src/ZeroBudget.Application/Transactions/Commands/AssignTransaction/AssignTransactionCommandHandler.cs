using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.Transactions.Dtos;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Application.Transactions.Commands.AssignTransaction;

public class AssignTransactionCommandHandler : IRequestHandler<AssignTransactionCommand, TransactionDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public AssignTransactionCommandHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<TransactionDto> Handle(AssignTransactionCommand request, CancellationToken cancellationToken)
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

        if (request.BudgetItemId is Guid itemId)
        {
            // The target line must belong to the same user (defence in depth).
            var item = await _db.BudgetItems
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

            transaction.BudgetItem = item;
            transaction.BudgetItemId = item.Id;

            // Putting a transaction on a line means the user is tracking it by
            // transactions — switch it out of manual entry so the roll-up shows.
            item.ActualEntryMode = ActualEntryMode.Tracked;

            // Learn the payee -> line mapping so future imports auto-categorize.
            await LearnRuleAsync(userId, transaction.Payee, item, cancellationToken);
        }
        else
        {
            transaction.BudgetItem = null;
            transaction.BudgetItemId = null;
        }

        await _db.SaveChangesAsync(cancellationToken);

        return transaction.ToDto();
    }

    /// <summary>Upsert the "payee → line" rule for this user (no-op for a blank payee).</summary>
    private async Task LearnRuleAsync(string ownerId, string payee, BudgetItem item, CancellationToken ct)
    {
        var payeeKey = CategorizationRule.NormalizeKey(payee);
        if (payeeKey.Length == 0)
        {
            return;
        }

        var existing = await _db.CategorizationRules
            .FirstOrDefaultAsync(r => r.OwnerId == ownerId && r.PayeeKey == payeeKey, ct);

        if (existing is null)
        {
            _db.CategorizationRules.Add(new CategorizationRule
            {
                OwnerId = ownerId,
                PayeeKey = payeeKey,
                CategoryName = item.BudgetCategory.Name,
                ItemName = item.Name,
            });
        }
        else
        {
            existing.CategoryName = item.BudgetCategory.Name;
            existing.ItemName = item.Name;
        }
    }
}
