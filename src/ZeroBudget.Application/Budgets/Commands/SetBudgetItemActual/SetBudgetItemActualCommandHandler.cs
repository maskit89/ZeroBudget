using MediatR;
using Microsoft.EntityFrameworkCore;
using ZeroBudget.Application.Budgets.Dtos;
using ZeroBudget.Application.Common.Exceptions;
using ZeroBudget.Application.Common.Interfaces;

namespace ZeroBudget.Application.Budgets.Commands.SetBudgetItemActual;

public class SetBudgetItemActualCommandHandler : IRequestHandler<SetBudgetItemActualCommand, BudgetMonthDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICurrentUser _currentUser;

    public SetBudgetItemActualCommandHandler(IApplicationDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<BudgetMonthDto> Handle(SetBudgetItemActualCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId
            ?? throw new ForbiddenAccessException("No authenticated user on the request.");

        var item = await _db.BudgetItems
            .Include(i => i.BudgetCategory)
                .ThenInclude(c => c.BudgetMonth)
            .FirstOrDefaultAsync(i => i.Id == request.BudgetItemId, cancellationToken);

        if (item is null)
        {
            throw new NotFoundException($"Budget item {request.BudgetItemId} was not found.");
        }

        // Ownership re-check (defence in depth — never trust the id alone).
        if (item.BudgetCategory.BudgetMonth.OwnerId != userId)
        {
            throw new ForbiddenAccessException();
        }

        item.ManualActualAmount = request.ActualAmount;
        await _db.SaveChangesAsync(cancellationToken);

        // Reload the full month graph so the recomputed actuals/remaining are returned.
        var monthId = item.BudgetCategory.BudgetMonthId;
        var month = await _db.BudgetMonths
            .AsNoTracking()
            .Include(m => m.Categories)
                .ThenInclude(c => c.Items)
            .FirstAsync(m => m.Id == monthId, cancellationToken);

        await BudgetActuals.ApplyAsync(_db, userId, month, cancellationToken);

        return month.ToDto();
    }
}
