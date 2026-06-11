using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;
using ZeroBudget.Application.Paychecks.Dtos;
using ZeroBudget.Domain.Entities;
using ZeroBudget.Domain.Enums;

namespace ZeroBudget.Application.Paychecks.Commands.SetPaycheckAllocations;

public class SetPaycheckAllocationsCommandHandler
    : IRequestHandler<SetPaycheckAllocationsCommand, PaycheckDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public SetPaycheckAllocationsCommandHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<PaycheckDto> Handle(
        SetPaycheckAllocationsCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        var paycheck = await _db.Paychecks
            .Include(p => p.Allocations)
            .FirstOrDefaultAsync(p => p.Id == request.PaycheckId, cancellationToken);

        if (paycheck is null)
        {
            throw new NotFoundException($"Paycheck {request.PaycheckId} was not found.");
        }
        if (paycheck.OwnerId != userId)
        {
            throw new ForbiddenAccessException();
        }

        // Validate each target line: it must be the user's, in this paycheck's month,
        // and a place money is spent (not an income source).
        var itemIds = request.Allocations.Select(a => a.BudgetItemId).Distinct().ToList();
        var items = await _db.BudgetItems
            .Include(i => i.BudgetCategory)
                .ThenInclude(c => c.BudgetMonth)
            .Where(i => itemIds.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id, cancellationToken);

        foreach (var id in itemIds)
        {
            if (!items.TryGetValue(id, out var item))
            {
                throw new NotFoundException($"Budget item {id} was not found.");
            }
            if (item.BudgetCategory.BudgetMonth.OwnerId != userId)
            {
                throw new ForbiddenAccessException();
            }
            if (item.BudgetCategory.BudgetMonthId != paycheck.BudgetMonthId)
            {
                throw Validation("You can only fund lines in the paycheck's own month.");
            }
            if (item.BudgetCategory.Kind == CategoryKind.Income)
            {
                throw Validation("A paycheck funds expense and fund lines, not income lines.");
            }
        }

        // Replace the previous allocations wholesale. Add via scalar FKs (the nav-graph
        // add throws DbUpdateConcurrencyException on EF InMemory).
        if (paycheck.Allocations.Count > 0)
        {
            _db.PaycheckAllocations.RemoveRange(paycheck.Allocations);
            paycheck.Allocations.Clear();
        }

        foreach (var allocation in request.Allocations)
        {
            _db.PaycheckAllocations.Add(new PaycheckAllocation
            {
                PaycheckId = paycheck.Id,
                BudgetItemId = allocation.BudgetItemId,
                Amount = allocation.Amount,
            });
        }

        await _db.SaveChangesAsync(cancellationToken);

        var saved = await _db.Paychecks
            .AsNoTracking()
            .Include(p => p.Allocations)
                .ThenInclude(a => a.BudgetItem)
            .FirstAsync(p => p.Id == paycheck.Id, cancellationToken);

        return saved.ToDto();
    }

    private static ValidationException Validation(string message) =>
        new(new Dictionary<string, string[]>
        {
            ["Allocations"] = new[] { message },
        });
}
