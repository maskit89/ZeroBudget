using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.Transactions.Dtos;

namespace ZeroBudget.Application.Transactions.Queries.GetTransactions;

public class GetTransactionsQueryHandler
    : IRequestHandler<GetTransactionsQuery, IReadOnlyList<TransactionDto>>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public GetTransactionsQueryHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<TransactionDto>> Handle(
        GetTransactionsQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        var query = _db.Transactions
            .AsNoTracking()
            .Include(t => t.BudgetItem)
            .Include(t => t.Account)
            .Include(t => t.Splits)
                .ThenInclude(s => s.BudgetItem)
            .Where(t => t.OwnerId == userId);

        if (request.Year is int year)
        {
            query = query.Where(t => t.Date.Year == year);
        }
        if (request.Month is int month)
        {
            query = query.Where(t => t.Date.Month == month);
        }
        if (request.UnassignedOnly)
        {
            query = query.Where(t => t.BudgetItemId == null);
        }

        var transactions = await query
            .OrderByDescending(t => t.Date)
            .ThenByDescending(t => t.Id)
            .ToListAsync(cancellationToken);

        return transactions.Select(t => t.ToDto()).ToList();
    }
}
